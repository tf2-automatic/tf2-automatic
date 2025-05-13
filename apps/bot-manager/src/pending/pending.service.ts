import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRedis } from '@songkeys/nestjs-redis';
import {
  BOT_EXCHANGE_NAME,
  TRADE_CHANGED_EVENT,
  TRADE_RECEIVED_EVENT,
  TRADE_SENT_EVENT,
  TradeChangedEvent,
  TradeOfferWithItems,
  TradeOfferWithAssets,
  TradeReceivedEvent,
  TradeSentEvent,
  Asset,
  Item,
  TRADES_POLLED_EVENT,
  TradesPolledEvent,
} from '@tf2-automatic/bot-data';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import Redis, { ChainableCommander } from 'ioredis';
import { BotsService } from '../bots/bots.service';
import assert from 'assert';
import SteamID from 'steamid';
import { ETradeOfferState } from 'steam-tradeoffer-manager';
import { pack, unpack } from 'msgpackr';
import { LockDuration, Locker } from '@tf2-automatic/locking';

type TradeOffer = TradeOfferWithItems | TradeOfferWithAssets;
type TradeOfferWithOwner = TradeOffer & { owner: string };

@Injectable()
export class PendingService implements OnApplicationBootstrap {
  private readonly locker: Locker;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly eventsService: NestEventsService,
    private readonly botsService: BotsService,
  ) {
    this.locker = new Locker(this.redis);
  }

  async onApplicationBootstrap() {
    await this.eventsService.subscribe(
      'bot-manager.pending-offers',
      BOT_EXCHANGE_NAME,
      [TRADE_RECEIVED_EVENT, TRADE_SENT_EVENT, TRADE_CHANGED_EVENT],
      this.handleOffers.bind(this),
      {
        retry: true,
      },
    );

    await this.eventsService.subscribe(
      'bot-manager.pending-polled',
      BOT_EXCHANGE_NAME,
      [TRADES_POLLED_EVENT],
      this.handlePoll.bind(this),
      {
        // Don't retry because we can just wait for another event
        retry: false,
      },
    );
  }

  async getPendingOffers(steamid: SteamID): Promise<TradeOfferWithOwner[]> {
    const bot = await this.botsService.getCachedBot(steamid);
    if (bot !== null) {
      return this.getPendingBotOffers(steamid);
    }

    return this.getPendingPartnerOffers(steamid);
  }

  async getPendingAssets(steamid: SteamID) {
    const offers = await this.getPendingOffers(steamid);

    const gain: Record<string, number> = {};
    const lose: Record<string, number> = {};

    const add = (
      item: Item | Asset,
      steamid: SteamID,
      object: Record<string, number>,
    ) => {
      const key = `${steamid}_${item.appid}_${item.contextid}_${item.assetid}`;
      object[key] = (object[key] ?? 0) + (item.amount ?? 1);
    };

    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i];

      const owner = new SteamID(offer.owner);
      const partner = new SteamID(offer.partner);

      const isPartner = offer.partner === steamid.getSteamID64();

      for (let j = 0; j < offer.itemsToGive.length; j++) {
        add(offer.itemsToGive[j], owner, !isPartner ? lose : gain);
      }

      for (let j = 0; j < offer.itemsToReceive.length; j++) {
        add(offer.itemsToReceive[j], partner, !isPartner ? gain : lose);
      }
    }

    return { gain, lose };
  }

  private async getPendingBotOffers(
    steamid: SteamID,
  ): Promise<TradeOfferWithOwner[]> {
    const key = this.getBotKey(steamid);

    const result = await this.redis.hgetallBuffer(key);

    const parsed: TradeOfferWithOwner[] = [];

    const steamid64 = steamid.getSteamID64();

    for (const id in result) {
      const offer: TradeOffer = unpack(result[id]);
      parsed.push({ ...offer, owner: steamid64 });
    }

    return parsed;
  }

  private async getPendingPartnerOffers(
    steamid: SteamID,
  ): Promise<TradeOfferWithOwner[]> {
    const theirKey = this.getPartnerKey(steamid);

    const relations = await this.redis.hgetall(theirKey);

    const steamid64ToIds: Record<string, string[]> = {};

    for (const id in relations) {
      const steamid64 = relations[id];
      steamid64ToIds[steamid64] = steamid64ToIds[steamid64] ?? [];
      steamid64ToIds[steamid64].push(id);
    }

    const pipeline = this.redis.pipeline();

    const steamid64s = Object.keys(steamid64ToIds);

    for (let i = 0; i < steamid64s.length; i++) {
      const steamid64 = steamid64s[i];
      const ids = steamid64ToIds[steamid64];

      const ourKey = this.getBotKey(new SteamID(steamid64));
      pipeline.hmgetBuffer(ourKey, ...ids);
    }

    const result = await pipeline.exec();
    if (result === null) {
      throw new Error('Pipeline returned null');
    }

    const offers: TradeOfferWithOwner[] = [];

    for (let i = 0; i < result.length; i++) {
      const item = result[i];
      if (item[0] !== null) {
        throw item[0];
      }

      const matched = item[1] as (Buffer | null)[];

      for (let j = 0; j < matched.length; j++) {
        const match = matched[j];
        // TODO: Remove id if no match?
        if (match === null) {
          continue;
        }

        const offer: TradeOffer = unpack(match);
        offers.push({ ...offer, owner: steamid64s[i] });
      }
    }

    return offers;
  }

  private async handleOffers(
    event: TradeReceivedEvent | TradeSentEvent | TradeChangedEvent,
  ): Promise<void> {
    assert(event.metadata.steamid64, 'SteamID64 is not set');
    const botSteamID = new SteamID(event.metadata.steamid64);

    const multi = this.redis.multi();

    const offer = event.data.offer;
    const offers = [offer];

    if (
      offer.state === ETradeOfferState.Active ||
      offer.state === ETradeOfferState.CreatedNeedsConfirmation
    ) {
      this.saveOffers(multi, botSteamID, offers);
    } else {
      this.deleteOffers(multi, botSteamID, offers);
    }

    // No need to do any locking
    await multi.exec();
  }

  private async handlePoll(event: TradesPolledEvent) {
    assert(event.metadata.steamid64, 'SteamID64 is not set');
    const steamid = new SteamID(event.metadata.steamid64);

    const bot = await this.botsService.getBot(steamid).catch(() => {
      return null;
    });

    if (!bot || bot.lastSeen > event.metadata.time) {
      // Bot does not exist or event was made before the last heartbeat
      return;
    }

    const offers = await this.botsService.getActiveOffers(bot);

    const list: TradeOffer[] = [];

    for (let i = 0; i < offers.sent.length; i++) {
      list.push(offers.sent[i]);
    }

    for (let i = 0; i < offers.received.length; i++) {
      list.push(offers.received[i]);
    }

    await this.savePolledOffers(steamid, list);
  }

  private async savePolledOffers(
    botSteamID: SteamID,
    offers: TradeOffer[],
  ): Promise<void> {
    const ourKey = this.getBotKey(botSteamID);

    // We are only locking here to ensure that we are cleaning up properly
    await this.locker.using([ourKey], LockDuration.SHORT, async (signal) => {
      const existing = await this.redis.hgetallBuffer(ourKey);

      if (signal.aborted) {
        throw signal.error;
      }

      const newIds = new Set<string>();
      for (let i = 0; i < offers.length; i++) {
        newIds.add(offers[i].id);
      }

      // A list of offer ids that were previously in the list but are not in the new list
      const missing: Record<string, TradeOffer[]> = {};
      for (const id in existing) {
        if (!newIds.has(id)) {
          const offer: TradeOffer = unpack(existing[id]);
          missing[offer.partner] = missing[offer.partner] ?? [];
          missing[offer.partner].push(offer);
        }
      }

      const multi = this.redis.multi();

      for (const steamid in missing) {
        this.deleteOffers(multi, botSteamID, missing[steamid]);
      }

      // Clear our own set
      multi.del(ourKey);

      this.saveOffers(multi, botSteamID, offers);

      await multi.exec();
    });
  }

  private deleteOffers(
    multi: ChainableCommander,
    steamid: SteamID,
    offers: TradeOffer[],
  ): ChainableCommander {
    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i];

      const theirKey = this.getPartnerKey(new SteamID(offer.partner));
      multi.hdel(theirKey, ...offers.map((offer) => offer.id));

      // Remove the offer from our set
      multi.hdel(this.getBotKey(steamid), offer.id);

      // Remove the offer from the partner set
      multi.hdel(theirKey, offer.id);
    }

    return multi;
  }

  private saveOffers(
    multi: ChainableCommander,
    bot: SteamID,
    offers: TradeOffer[],
  ): ChainableCommander {
    const ourKey = this.getBotKey(bot);

    const theirKeys = new Set<string>();

    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i];

      const theirKey = this.getPartnerKey(new SteamID(offer.partner));
      theirKeys.add(theirKey);

      // Add the offer to our set
      multi.hset(ourKey, offer.id, pack(offer));
      // Add the offer to the partner set
      multi.hset(theirKey, offer.id, bot.getSteamID64());
    }

    // Expire keys
    multi.expire(ourKey, 600);
    for (const theirKey of theirKeys) {
      multi.expire(theirKey, 600);
    }

    return multi;
  }

  private getBotKey(bot: SteamID): string {
    return `active-offers:${bot.getSteamID64()}`;
  }

  private getPartnerKey(partner: SteamID): string {
    return `active-offers-partner:${partner.getSteamID64()}`;
  }
}
