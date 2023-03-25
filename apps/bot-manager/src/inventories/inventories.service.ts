import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  BOT_EXCHANGE_NAME,
  ExchangeDetailsItem,
  INVENTORIES_BASE_URL,
  Inventory,
  INVENTORY_PATH,
  Item,
  TF2LostEvent,
  TF2_LOST_EVENT,
  TradeChangedEvent,
  TRADE_CHANGED_EVENT,
} from '@tf2-automatic/bot-data';
import {
  Bot,
  BOT_MANAGER_EXCHANGE_NAME,
  ExchangeDetailsEvent,
  EXCHANGE_DETAILS_EVENT,
  InventoryLoadedEvent,
  InventoryResponse,
  INVENTORY_LOADED_EVENT,
} from '@tf2-automatic/bot-manager-data';
import { Redis } from 'ioredis';
import { firstValueFrom } from 'rxjs';
import SteamUser from 'steam-user';
import SteamID from 'steamid';
import { EventsService } from '../events/events.service';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';
import { GetInventoryDto } from '@tf2-automatic/dto';

const INVENTORY_EXPIRE_TIME = 600;

interface InventoryWithTimestamp {
  timestamp: number;
  inventory: Inventory;
}

@Injectable()
export class InventoriesService {
  constructor(
    @InjectRedis()
    private readonly redis: Redis,
    private readonly httpService: HttpService,
    private readonly heartbeatsService: HeartbeatsService,
    private readonly eventsService: EventsService
  ) {}

  async getInventoryFromBot(
    bot: Bot,
    steamid: SteamID,
    appid: number,
    contextid: string
  ): Promise<InventoryWithTimestamp> {
    const now = Math.floor(Date.now() / 1000);

    const response = await firstValueFrom(
      this.httpService.get<Inventory>(
        `http://${bot.ip}:${bot.port}${INVENTORIES_BASE_URL}${INVENTORY_PATH}`
          .replace(':steamid', steamid.getSteamID64())
          .replace(':appid', appid.toString())
          .replace(':contextid', contextid)
      )
    );

    const inventory = response.data;

    const object = inventory.reduce((acc, item) => {
      acc[`item:${item.assetid}`] = JSON.stringify(item);
      return acc;
    }, {});

    object['timestamp'] = now;

    const key = this.getInventoryKey(steamid, appid, contextid);

    // Save inventory in Redis and make it expire
    await this.redis
      .pipeline()
      .hset(key, object)
      .expire(key, INVENTORY_EXPIRE_TIME)
      .exec();

    await this.eventsService.publish(INVENTORY_LOADED_EVENT, {
      steamid64: steamid.getSteamID64(),
      appid,
      contextid,
      timestamp: now,
      itemCount: inventory.length,
    } satisfies InventoryLoadedEvent['data']);

    return {
      timestamp: now,
      inventory,
    };
  }

  async deleteInventory(
    steamid: SteamID,
    appid: number,
    contextid: string
  ): Promise<void> {
    const key = this.getInventoryKey(steamid, appid, contextid);
    await this.redis.del(key);
  }

  async getInventory(
    steamid: SteamID,
    appid: number,
    contextid: string,
    query: GetInventoryDto
  ): Promise<InventoryResponse> {
    // Check if inventory is in the cache
    const cached = await this.getInventoryFromCache(steamid, appid, contextid);
    if (cached !== null) {
      return {
        cached: true,
        timestamp: cached.timestamp,
        inventory: cached.inventory,
      };
    }

    let bot: Bot;

    if (query.bot !== undefined) {
      // Get specific bot
      bot = await this.heartbeatsService.getBot(query.bot);
    } else {
      // If the client wants non-cached data then fetch it, store it, and return it
      const bots = await this.heartbeatsService.getBots();
      if (bots.length === 0) {
        throw new ServiceUnavailableException('No bots available');
      }

      // Choose a random bot
      bot = bots[Math.floor(Math.random() * bots.length)];
    }

    // Get the inventory of the bot
    return this.getInventoryFromBot(bot, steamid, appid, contextid).then(
      (result) => ({
        cached: false,
        timestamp: result.timestamp,
        inventory: result.inventory,
      })
    );
  }

  async getInventoryFromCache(
    steamid: SteamID,
    appid: number,
    contextid: string
  ): Promise<InventoryWithTimestamp | null> {
    const key = this.getInventoryKey(steamid, appid, contextid);

    const timestamp = await this.redis.hget(key, 'timestamp');
    if (timestamp === null) {
      // Inventory is not in the cache
      return null;
    }

    const object = await this.redis.hgetall(key);

    const inventory = Object.keys(object)
      .filter((key) => {
        return key.startsWith('item:');
      })
      .map((item) => JSON.parse(object[item]));

    return {
      timestamp: parseInt(timestamp, 10),
      inventory,
    };
  }

  @RabbitSubscribe({
    exchange: BOT_EXCHANGE_NAME,
    routingKey: [TF2_LOST_EVENT, TRADE_CHANGED_EVENT],
    queue: 'bot-manager.delete-inventory-items',
    allowNonJsonMessages: false,
  })
  private handleDeleteInventoryItems(
    event: TF2LostEvent | TradeChangedEvent
  ): Promise<void> {
    switch (event.type) {
      case TRADE_CHANGED_EVENT:
        return this.handleOfferChanged(event as TradeChangedEvent);
      case TF2_LOST_EVENT:
        return this.handleItemLost(event as TF2LostEvent);
      default:
        return Promise.resolve();
    }
  }

  @RabbitSubscribe({
    exchange: BOT_MANAGER_EXCHANGE_NAME,
    routingKey: EXCHANGE_DETAILS_EVENT,
    queue: 'bot-manager.add-inventory-items',
    allowNonJsonMessages: false,
  })
  private async handleAddInventoryItems(
    event: ExchangeDetailsEvent
  ): Promise<void> {
    const gainedItems: Record<string, [string, string][]> = {};

    const addGainedItems = (steamid: SteamID, items: Item[]) => {
      items.reduce((acc, cur) => {
        const items = (acc[
          this.getInventoryKey(steamid, cur.appid, cur.contextid)
        ] = acc[cur.appid] ?? []);

        items.push(['item:' + cur.assetid, JSON.stringify(cur)]);
        return acc;
      }, gainedItems);
    };

    const mapItem = (item: ExchangeDetailsItem): Item => {
      const newItem = { ...item };
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      newItem.assetid = item.new_assetid!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      newItem.contextid = item.new_contextid!;
      delete newItem.new_assetid;
      delete newItem.new_contextid;
      return newItem;
    };

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const ourSteamID = new SteamID(event.metadata.steamid64!);
    const theirSteamID = new SteamID(event.data.offer.partner);

    const receivedItems = event.data.details.receivedItems.map(mapItem);
    const sentItems = event.data.details.sentItems.map(mapItem);

    addGainedItems(ourSteamID, receivedItems);
    addGainedItems(theirSteamID, sentItems);

    // Check if cached inventories exist for the given items
    const inventoriesExists = await Promise.all(
      Object.keys(gainedItems).map((key) => {
        return this.redis.exists(key).then((exists) => {
          return {
            key,
            exists,
          };
        });
      })
    );

    await Promise.all(
      inventoriesExists
        .filter((inventory) => inventory.exists)
        .map((inventory) => {
          const items = gainedItems[inventory.key];

          // Add the items to the cached inventories
          return this.redis.hmset(inventory.key, ...items.flat());
        })
    );
  }

  private async handleOfferChanged(event: TradeChangedEvent): Promise<void> {
    if (event.data.offer.state !== SteamUser.ETradeOfferState.Accepted) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const ourSteamID = new SteamID(event.metadata.steamid64!);
    const theirSteamID = new SteamID(event.data.offer.partner);

    // Create an object of inventory keys which each contains an array of items to delete
    const lostItems: Record<string, string[]> = {};

    const addLostItems = (steamid: SteamID, items: Item[]) => {
      items.reduce((acc, cur) => {
        const items = (acc[
          this.getInventoryKey(steamid, cur.appid, cur.contextid)
        ] = acc[cur.appid] ?? []);

        items.push('item:' + cur.assetid);
        return acc;
      }, lostItems);
    };

    // Add items to the object
    addLostItems(ourSteamID, event.data.offer.itemsToGive);
    addLostItems(theirSteamID, event.data.offer.itemsToReceive);

    // Delete the items
    await Promise.all(
      Object.keys(lostItems).map((key) =>
        this.redis.hdel(key, ...lostItems[key])
      )
    );
  }

  private async handleItemLost(event: TF2LostEvent): Promise<void> {
    const key = this.getInventoryKey(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      new SteamID(event.metadata.steamid64!),
      440,
      '2'
    );

    // Delete item from cached inventory
    await this.redis.hdel(key, 'item:' + event.data.id);
  }

  private getInventoryKey(steamid: SteamID, appid: number, contextid: string) {
    return `:inventory:${steamid.getSteamID64()}:${appid}:${contextid}`;
  }
}
