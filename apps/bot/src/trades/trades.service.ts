import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import SteamTradeOfferManager from 'steam-tradeoffer-manager';
import ActualTradeOffer from 'steam-tradeoffer-manager/lib/classes/TradeOffer';
import {
  CreateTradeResponse,
  GetTradesResponse,
  Item,
  TradeOffer,
  TradeOfferExchangeDetails,
  TRADE_CHANGED_EVENT,
  TRADE_RECEIVED_EVENT,
  TRADE_SENT_EVENT,
  TRADE_CONFIRMATION_NEEDED_EVENT,
  ExchangeDetailsItem,
  Asset,
  AcceptTradeResponse,
  DeleteTradeResponse,
  GetTradeResponse,
  OfferFilter,
} from '@tf2-automatic/bot-data';
import { SteamException } from '../common/exceptions/eresult.exception';
import {
  Config,
  SteamAccountConfig,
  SteamTradeConfig,
} from '../common/config/configuration';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common/services';
import { EventsService } from '../events/events.service';
import fastq from 'fastq';
import type { queueAsPromised } from 'fastq';
import { EResult, ETradeOfferState } from 'steam-user';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Counter, Gauge } from 'prom-client';
import sizeof from 'object-sizeof';
import {
  CounterTradeDto,
  CreateTradeDto,
  GetExchangeDetailsDto,
  GetTradesDto,
} from '@tf2-automatic/dto';
import Bottleneck from 'bottleneck';
import CEconItem from 'steamcommunity/classes/CEconItem';
import { GarbageCollectorService } from './gc.service';
import { TradeOfferData } from './types';
import NodeCache from 'node-cache';
import assert from 'assert';

@Injectable()
export class TradesService {
  private readonly logger: Logger = new Logger(TradesService.name);

  private readonly manager = this.botService.getManager();
  private readonly community = this.botService.getCommunity();

  private readonly ensurePolldataPublishedQueue: queueAsPromised<string> =
    fastq.promise(this.ensurePolldataPublished.bind(this), 1);

  private readonly ensureOfferPublishedQueue: queueAsPromised<ActualTradeOffer> =
    fastq.promise(this.ensureOfferPublished.bind(this), 1);

  private ensurePollDataTimeout: NodeJS.Timeout;
  private ensureOfferPublishedLimiter = new Bottleneck({
    minTime: 1000,
  });

  private cache: NodeCache;

  constructor(
    private readonly botService: BotService,
    private readonly configService: ConfigService<Config>,
    private readonly eventsService: EventsService,
    private readonly gc: GarbageCollectorService,
    @InjectMetric('bot_offers_sent_total')
    private readonly sentCounter: Counter,
    @InjectMetric('bot_offers_received_total')
    private readonly receivedCounter: Counter,
    @InjectMetric('bot_polldata_size_bytes')
    private readonly pollDataSize: Gauge,
    @InjectMetric('bot_asset_cache_size_bytes')
    private readonly assetCacheSize: Gauge,
    @InjectMetric('bot_offers_active')
    private readonly activeOffers: Gauge,
  ) {
    const pullFullUpdateIntervalSeconds =
      this.configService.getOrThrow<SteamTradeConfig>('trade')
        .pollFullUpdateInterval / 1000;

    this.cache = new NodeCache({
      useClones: false,
      stdTTL: pullFullUpdateIntervalSeconds * 2,
      checkperiod: pullFullUpdateIntervalSeconds,
    });

    this.manager.on('newOffer', (offer) => {
      this.handleNewOffer(offer);
    });

    this.manager.on('sentOfferChanged', (offer, oldState) => {
      this.handleOfferChanged(offer, oldState);
    });

    this.manager.on('receivedOfferChanged', (offer, oldState) => {
      this.handleOfferChanged(offer, oldState);
    });

    this.manager.on('pollSuccess', () => {
      this.ensurePollData();
    });

    // Capture offers from getOffers function to detect relevant changes
    const origGetOffers = this.manager.getOffers.bind(this.manager);
    this.manager.getOffers = (...args) => {
      const callback = args.pop();
      origGetOffers(...args, (err, sent, received) => {
        if (err) {
          return callback(err);
        }

        callback(err, sent, received);

        const gotAll =
          args.length === 2 &&
          args[0] === 3 &&
          new Date(args[1]).getTime() === 1000;

        try {
          this.handleOffers(sent, received, gotAll);
        } catch (err) {
          // Catch the error because we don't want trade offer manager to think an error occurred
          this.logger.warn('Error while handling offers: ' + err.message);
        }
      });
    };

    const origGetOffer = this.manager.getOffer.bind(this.manager);
    this.manager.getOffer = (id, callback) => {
      origGetOffer(id, (err, offer) => {
        if (err) {
          // @ts-expect-error The callback expects an offer to be returned at all time
          return callback(err);
        }

        this.handleOffer(offer);

        return callback(null, offer);
      });
    };

    const origDoPoll = this.manager.doPoll.bind(this.manager);
    this.manager.doPoll = (...args) => {
      if (this.botService.isRunning() === false) {
        // Bot is not running, don't poll
        return;
      }

      return origDoPoll(...args);
    };
  }

  private handleOffers(
    sent: ActualTradeOffer[],
    received: ActualTradeOffer[],
    isAll: boolean,
  ) {
    if (this.manager.pollData.offerData === undefined) {
      this.manager.pollData.offerData = {};
    }

    sent.forEach((offer) => this.handleOffer(offer));
    received.forEach((offer) => this.handleOffer(offer));

    if (isAll) {
      this.gc.cleanup(sent, received);
    }
  }

  private handleOffer(offer: ActualTradeOffer) {
    assert(offer.id, 'Offer ID is missing');

    this.cache.set(offer.id, offer);

    this.ensureOfferPublishedQueue.push(offer).catch(() => {
      // Ignore error
    });
  }

  private ensurePollData(): void {
    clearTimeout(this.ensurePollDataTimeout);

    this.ensurePollDataTimeout = setTimeout(() => {
      // Set polldata size inside timeout to minimize amount of times it is calculated
      this.pollDataSize.set(sizeof(this.manager.pollData));

      const { sent, received } = this.getActiveOfferCounts();

      this.activeOffers.set({ type: 'sent' }, sent);
      this.activeOffers.set({ type: 'received' }, received);
      this.activeOffers.set({ type: 'total' }, sent + received);

      this.logger.debug('Enqueuing offers to ensure poll data is published');

      const ensurePublished = (id: string): void => {
        this.ensurePolldataPublishedQueue.push(id).catch((err) => {
          // Ignore the error
          this.logger.warn('Error ensuring offer published: ' + err.message);
          console.log(err);
        });
      };

      Object.keys(this.manager.pollData.sent).forEach(ensurePublished);
      Object.keys(this.manager.pollData.received).forEach(ensurePublished);
    }, 10000);
  }

  private getActiveOfferCounts(): { sent: number; received: number } {
    let sent = 0,
      received = 0;

    Object.keys(this.manager.pollData.sent).forEach((id) => {
      const state = this.manager.pollData.sent[id];

      if (state === ETradeOfferState.Active) {
        sent++;
      }
    });

    Object.keys(this.manager.pollData.received).forEach((id) => {
      const state = this.manager.pollData.received[id];

      if (state === ETradeOfferState.Active) {
        received++;
      }
    });

    return {
      sent,
      received,
    };
  }

  private async ensurePolldataPublished(id: string): Promise<void> {
    // Check if offer was already published
    const currentState =
      this.manager.pollData.sent[id] ??
      this.manager.pollData.received[id] ??
      null;

    if (currentState !== null) {
      const pollDataOfferData = this.manager.pollData.offerData ?? {};

      const offerData: TradeOfferData = pollDataOfferData[id] ?? {};
      if (currentState === offerData.published) {
        // Offer was already published
        return;
      }
    }

    this.logger.debug('Getting offer #' + id + ' to ensure it is published');

    // Get the actual offer
    const offer = await this.ensureOfferPublishedLimiter.schedule(() =>
      this._getTrade(id),
    );

    return this.ensureOfferPublishedQueue.push(offer);
  }

  private ensureOfferPublished(offer: ActualTradeOffer): Promise<void> {
    return this.ensureOfferStatePublished(offer).then(() => {
      return this.ensureConfirmationPublished(offer);
    });
  }

  private ensureOfferStatePublished(offer: ActualTradeOffer): Promise<void> {
    const offerData = offer.data() as TradeOfferData;

    if (offer.state === offerData.published) {
      // This check is redundant but it's here just in case
      return Promise.resolve();
    }

    return this.publishOffer(offer, offerData.published);
  }

  private ensureConfirmationPublished(offer: ActualTradeOffer): Promise<void> {
    if (
      offer.confirmationMethod ===
      SteamTradeOfferManager.EConfirmationMethod.None
    ) {
      // Offer is not waiting to be confirmed
      return Promise.resolve();
    } else if (
      offer.state !== ETradeOfferState.Active &&
      offer.state !== ETradeOfferState.CreatedNeedsConfirmation
    ) {
      // Offer is not active or created needs confirmation
      return Promise.resolve();
    } else if (
      !offer.isOurOffer &&
      offer.data('conf') === offer.data('accept')
    ) {
      // Confirmation was already published
      return Promise.resolve();
    } else if (offer.isOurOffer && offer.data('conf') !== undefined) {
      // Confirmation was already published
      return Promise.resolve();
    }

    // Publish confirmation
    return this.eventsService
      .publish(TRADE_CONFIRMATION_NEEDED_EVENT, {
        offer: this.mapOffer(offer),
      })
      .then(() => {
        // Update offer data to prevent publishing confirmation multiple times
        offer.data('conf', offer.data('accept') ?? Date.now());
      })
      .catch(() => {
        // Ignore error
      });
  }

  private handleNewOffer(offer: ActualTradeOffer) {
    this.logger.log(
      `Received offer #${offer.id} from ${offer.partner.getSteamID64()}`,
    );
    this.receivedCounter.inc();
  }

  private handleOfferChanged(
    offer: ActualTradeOffer,
    oldState: ETradeOfferState,
  ): void {
    this.logger.log(
      `Offer #${offer.id} state changed: ${
        ETradeOfferState[oldState]
      } -> ${ETradeOfferState[offer.state]}`,
    );
  }

  private publishOffer(
    offer: ActualTradeOffer,
    oldState: ETradeOfferState | null = null,
  ): Promise<void> {
    const publish = (): Promise<void> => {
      if (oldState) {
        return this.eventsService.publish(TRADE_CHANGED_EVENT, {
          offer: this.mapOffer(offer),
          oldState,
        });
      }

      if (!offer.isOurOffer) {
        // Offer was sent to us and there is no old state
        if (offer.state === ETradeOfferState.Active) {
          // Offer is active, means we received it
          return this.eventsService.publish(TRADE_RECEIVED_EVENT, {
            offer: this.mapOffer(offer),
          });
        }

        // Offer is not active, means the state changed, but we don't know what it changed from
        return this.eventsService.publish(TRADE_CHANGED_EVENT, {
          offer: this.mapOffer(offer),
          oldState: null,
        });
      }

      // Offer is ours and there is no old state

      if (offer.state === ETradeOfferState.CreatedNeedsConfirmation) {
        // Offer is waiting for confirmation, means we sent it
        return this.eventsService.publish(TRADE_SENT_EVENT, {
          offer: this.mapOffer(offer),
        });
      }

      if (offer.state === ETradeOfferState.Active) {
        // Offer is active, means it is either sent now or changed
        if (offer.itemsToGive.length === 0) {
          // Offer is active and we are giving nothing, means we sent it without confirmation
          return this.eventsService.publish(TRADE_SENT_EVENT, {
            offer: this.mapOffer(offer),
          });
        }
      }

      // Offer is not active, or created and needs confirmation.

      return this.eventsService.publish(TRADE_CHANGED_EVENT, {
        offer: this.mapOffer(offer),
        oldState: null,
      });
    };

    // Wait for the event to be published
    return publish()
      .then(() => {
        offer.data(
          'published',
          offer.state satisfies TradeOfferData['published'],
        );
      })
      .catch((err) => {
        this.logger.warn('Error publishing offer: ' + err.message);
      });
  }

  async getTrades(dto: GetTradesDto): Promise<GetTradesResponse> {
    if (dto.useCache === true) {
      return this.getTradesFromCache(dto.filter);
    }

    return this._getTrades(dto.filter);
  }

  private async getTradesFromCache(
    filter: OfferFilter,
  ): Promise<GetTradesResponse> {
    const cached = this.cache.mget<ActualTradeOffer>(this.cache.keys());

    const sent: ActualTradeOffer[] = [];
    const received: ActualTradeOffer[] = [];

    function addOffer(offer: ActualTradeOffer | Error) {
      if (offer instanceof Error) {
        return;
      }

      if (offer.isOurOffer) {
        sent.push(offer);
      } else {
        received.push(offer);
      }
    }

    for (const id in cached) {
      const offer = cached[id];

      if (filter === OfferFilter.All) {
        addOffer(offer);
      } else {
        // FIXME: Is InEscrow an active or historical state?
        const isActive =
          offer.state === ETradeOfferState.Active ||
          offer.state === ETradeOfferState.CreatedNeedsConfirmation;

        if (isActive && filter === OfferFilter.ActiveOnly) {
          addOffer(offer);
        } else if (!isActive && filter === OfferFilter.HistoricalOnly) {
          addOffer(offer);
        }
      }
    }

    return {
      sent: this.mapOffers<Item>(sent),
      received: this.mapOffers<Item>(received),
    };
  }

  private async _getTrades(filter: OfferFilter): Promise<GetTradesResponse> {
    return new Promise<GetTradesResponse>((resolve, reject) => {
      this.manager.getOffers(filter, (err, sent, received) => {
        if (err) {
          return reject(err);
        }

        const sentMapped = this.mapOffers<Item>(sent);
        const receivedMapped = this.mapOffers<Item>(received);

        return resolve({ sent: sentMapped, received: receivedMapped });
      });
    }).catch((err) => {
      this.logger.error(
        `Error getting trades: ${err.message}${
          err.eresult !== undefined ? ` (eresult: ${err.eresult})` : ''
        }`,
      );
      throw err;
    });
  }

  private _getTrade(id: string, useCache = true): Promise<ActualTradeOffer> {
    return new Promise((resolve, reject) => {
      if (useCache) {
        const cached = this.cache.get<ActualTradeOffer | Error>(id);
        if (cached) {
          if (cached instanceof Error) {
            return reject(cached);
          }
          return resolve(cached);
        }
      }

      this.manager.getOffer(id, (err, offer) => {
        if (err) {
          this.cache.del(id);

          if (err.message === 'NoMatch') {
            const err = new NotFoundException('Trade offer not found');
            this.cache.set(id, err);
            return reject(err);
          }

          if (err.eresult !== undefined || err.cause !== undefined) {
            return reject(
              new SteamException(
                err.message,
                err.eresult as EResult | undefined,
                err.cause as string | undefined,
              ),
            );
          }

          return reject(err);
        }

        return resolve(offer);
      });
    });
  }

  private async getTradeAndLogError(
    id: string,
    useCache = false,
  ): Promise<ActualTradeOffer> {
    const hasCache = this.cache.has(id);
    return this._getTrade(id, useCache).catch((err) => {
      if (!hasCache) {
        this.logger.error(
          `Error getting trade offer: ${err.message}${
            err.eresult !== undefined ? ` (eresult: ${err.eresult})` : ''
          }`,
        );
      }

      throw err;
    });
  }

  async getTrade(id: string, useCache = false): Promise<GetTradeResponse> {
    const offer = await this.getTradeAndLogError(id, useCache);
    return this.mapOffer(offer);
  }

  /**
   * Gets a trade offer and publishes it even if it was already published
   */
  async refreshTrade(id: string): Promise<GetTradeResponse> {
    const offer = await this.getTradeAndLogError(id);

    // Publish the offer and say the old state was the last published state
    await this.publishOffer(offer, offer.data('published'));

    return this.mapOffer(offer);
  }

  createTrade(dto: CreateTradeDto): Promise<CreateTradeResponse> {
    const offer = this.manager.createOffer(dto.partner);

    if (dto.token) {
      offer.setToken(dto.token);
    }

    if (dto.message) {
      offer.setMessage(dto.message);
    }

    offer.addMyItems(dto.itemsToGive as CEconItem[]);
    offer.addTheirItems(dto.itemsToReceive as CEconItem[]);

    return this.sendOffer(offer);
  }

  async counterTrade(
    id: string,
    dto: CounterTradeDto,
  ): Promise<CreateTradeResponse> {
    const offer = await this._getTrade(id);
    assert(offer.id, 'Offer ID is missing');
    this.isActiveOrThrow(offer, true);

    const counter = offer.counter();

    if (dto.message) {
      counter.setMessage(dto.message);
    }

    // Remove all items from the offer
    counter.itemsToGive = [];
    counter.itemsToReceive = [];

    // Add the new items to the offer
    counter.addMyItems(dto.itemsToGive as CEconItem[]);
    counter.addTheirItems(dto.itemsToReceive as CEconItem[]);

    this.cache.del(offer.id);

    return this.sendOffer(counter);
  }

  private async sendOffer(
    offer: ActualTradeOffer,
  ): Promise<CreateTradeResponse> {
    this.logger.log(`Sending offer to ${offer.partner}...`);

    this.logger.debug(
      `Items to give: [${offer.itemsToGive
        .map((item) => `"${item.appid}_${item.contextid}_${item.assetid}"`)
        .join(',')}]`,
    );
    this.logger.debug(
      `Items to receive: [${offer.itemsToReceive
        .map((item) => `"${item.appid}_${item.contextid}_${item.assetid}"`)
        .join(',')}]`,
    );

    await this._sendOffer(offer).catch((err) => {
      this.handleError(err);
      throw err;
    });

    this.logger.log(
      `Offer #${offer.id} sent to ${offer.partner} has state ${
        ETradeOfferState[offer.state]
      }`,
    );

    this.sentCounter.inc();

    // Add offer to queue to ensure state and confirmation is published if needed
    this.ensureOfferPublishedQueue.push(offer).catch(() => {
      // Ignore error
    });

    this.updateOffer(offer).catch((err) => {
      this.logger.warn('Failed to update offer: ' + err.message);
    });

    return this.mapOffer(offer);
  }

  private _sendOffer(offer: ActualTradeOffer): Promise<void> {
    return new Promise((resolve, reject) => {
      offer.send((err) => {
        if (err) {
          this.logger.error(
            `Got an error while sending trade offer: ${err.message}${
              err.eresult !== undefined ? ` (eresult: ${err.eresult})` : ''
            }`,
          );

          if (err.message === 'Cannot send an empty trade offer') {
            return reject(
              new BadRequestException('Cannot send an empty trade offer'),
            );
          }

          if (err.eresult !== undefined || err.cause !== undefined) {
            return reject(
              // @ts-expect-error FIXME: Wait for https://github.com/DefinitelyTyped/DefinitelyTyped/pull/67155
              new SteamException(err.message, err.eresult, err.cause),
            );
          }

          return reject(err);
        }

        assert(offer.id, 'Offer ID is missing');
        // This means that the cached offers may not contain complete items
        this.cache.set(offer.id, offer);

        resolve();
      });
    });
  }

  private updateOffer(offer: ActualTradeOffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (offer.id === undefined) {
        throw new Error(' Offer ID is missing');
      }

      offer.update((err) => {
        if (err) {
          if (err.eresult !== undefined || err.cause !== undefined) {
            return reject(
              // @ts-expect-error Something is not right
              new SteamException(err.message, err.eresult, err.cause),
            );
          }
          return reject(err);
        }

        // This is technically unnessesary but nice to do anyway
        assert(offer.id, 'Offer ID is missing');
        this.cache.set(offer.id, offer);

        resolve();
      });
    });
  }

  async checkAccepted(id: string): Promise<boolean> {
    const offer = await this._getTrade(id);

    if (
      offer.state === ETradeOfferState.Accepted ||
      offer.state === ETradeOfferState.InEscrow
    ) {
      return true;
    }

    if (
      offer.confirmationMethod !==
      SteamTradeOfferManager.EConfirmationMethod.None
    ) {
      return true;
    }

    return false;
  }

  async acceptTrade(id: string): Promise<AcceptTradeResponse> {
    const accepted = await this.checkAccepted(id);
    if (accepted) {
      throw new BadRequestException('Offer is already accepted');
    }

    const offer = await this._getTrade(id);
    this.isActiveOrThrow(offer, true);

    await this._acceptTrade(offer).catch((err) => {
      this.handleError(err);
      throw err;
    });

    // Set accept time to result in confirmation being published again
    offer.data('accept', Date.now());

    // Add offer to queue to ensure state and confirmation is published if needed
    this.ensureOfferPublishedQueue.push(offer).catch(() => {
      // Ignore error
    });

    return this.mapOffer(offer);
  }

  private _acceptTrade(offer: ActualTradeOffer): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      assert(offer.id, 'Offer ID is missing');

      this.logger.log(`Accepting trade offer #${offer.id}...`);

      offer.accept(false, (err, state) => {
        if (err) {
          this.logger.error(
            `Got an error while accepting trade offer: ${err.message}${
              err.eresult !== undefined ? ` (eresult: ${err.eresult})` : ''
            }`,
          );

          if (err.eresult !== undefined || err.cause !== undefined) {
            return reject(
              new SteamException(
                err.message,
                err.eresult as EResult | undefined,
                err.cause,
              ),
            );
          }

          return reject(err);
        }

        assert(offer.id, 'Offer ID is missing');
        this.cache.set(offer.id, offer);

        this.logger.log(
          `Offer #${offer.id} from ${offer.partner} successfully accepted${
            state === 'pending' ? '; confirmation required' : ''
          }`,
        );

        return resolve(state);
      });
    });
  }

  async checkConfirmed(id: string): Promise<boolean> {
    const offer = await this._getTrade(id);
    if (offer.tradeID) {
      return true;
    }

    return false;
  }

  async acceptConfirmation(id: string): Promise<void> {
    const confirmed = await this.checkConfirmed(id);
    if (confirmed) {
      throw new BadRequestException('Trade is already confirmed');
    }

    const offer = await this._getTrade(id);
    if (
      offer.confirmationMethod ===
      SteamTradeOfferManager.EConfirmationMethod.None
    ) {
      throw new BadRequestException('Offer does not require confirmation');
    }

    await this._acceptConfirmation(id).catch((err) => {
      if (err.message === 'Could not find confirmation for object ' + id) {
        const message = 'Confirmation not found';
        throw new NotFoundException(message);
      }

      throw err;
    });

    this.manager.doPoll();
  }

  private _acceptConfirmation(id: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.logger.log(`Accepting confirmation for offer #${id}...`);

      this.community.acceptConfirmationForObject(
        this.configService.getOrThrow<SteamAccountConfig>('steam')
          .identitySecret,
        id,
        (err) => {
          if (err) {
            this.logger.error(
              `Error while accepting confirmation for ${id}: ${err.message}${
                err.eresult !== undefined ? ` (eresult: ${err.eresult})` : ''
              }`,
            );
            return reject(err);
          }

          this.logger.log(`Accepted confirmation for offer #${id}!`);

          return resolve();
        },
      );
    });
  }

  async checkRemoved(id: string): Promise<boolean> {
    const offer = await this._getTrade(id);

    if (
      offer.state === ETradeOfferState.Declined ||
      offer.state === ETradeOfferState.Canceled
    ) {
      return true;
    }

    return false;
  }

  async removeTrade(id: string): Promise<DeleteTradeResponse> {
    const removed = await this.checkRemoved(id);
    if (removed) {
      throw new BadRequestException('Offer is already removed');
    }

    const offer = await this._getTrade(id);
    this.isActiveOrThrow(offer, false);

    await this._removeTrade(offer).catch((err) => {
      this.handleError(err);
      throw err;
    });

    return this.mapOffer(offer);
  }

  private async _removeTrade(offer: ActualTradeOffer): Promise<void> {
    const id = offer.id;
    assert(id, 'Offer ID is missing');

    this.logger.debug('Removing trade offer #' + id + '...');

    return new Promise((resolve, reject) => {
      offer.cancel((err) => {
        if (err) {
          this.logger.error(
            `Error while removing trade offer #${id}: ${err.message}${
              err.eresult !== undefined ? ` (eresult: ${err.eresult})` : ''
            }`,
          );

          if (
            err.message ===
            `Offer #${id} is not active, so it may not be cancelled or declined`
          ) {
            return reject(new BadRequestException('Offer is not active'));
          } else if (err.eresult !== undefined) {
            return reject(
              new SteamException(
                err.message,
                err.eresult as unknown as EResult,
              ),
            );
          }

          return reject(err);
        }

        this.cache.del(id);

        this.logger.debug('Removed trade offer #' + id);

        resolve();
      });
    });
  }

  async getExchangeDetails(
    id: string,
    exchangeDetailsDto: GetExchangeDetailsDto,
  ): Promise<TradeOfferExchangeDetails> {
    const offer = await this._getTrade(id);

    if (!offer.tradeID) {
      throw new BadRequestException('No trade id');
    }

    return new Promise((resolve, reject) => {
      offer.getExchangeDetails(
        exchangeDetailsDto.getDetailsIfFailed,
        (err, status, tradeInitTime, receivedItems, sentItems) => {
          if (err) {
            if (err.message.startsWith('Trade status is ')) {
              return reject(new BadRequestException(err.message));
            }

            return reject(err);
          }

          return resolve({
            status,
            tradeInitTime: Math.floor(tradeInitTime.getTime() / 1000),
            receivedItems: receivedItems as unknown as ExchangeDetailsItem[],
            sentItems: sentItems as unknown as ExchangeDetailsItem[],
          });
        },
      );
    });
  }

  async getReceivedItems(id: string): Promise<Item[]> {
    const offer = await this._getTrade(id);

    if (offer.state !== ETradeOfferState.Accepted) {
      throw new BadRequestException('Offer is not accepted');
    }

    return new Promise((resolve, reject) => {
      offer.getReceivedItems((err, items) => {
        if (err) {
          return reject(err);
        }

        return resolve(items as unknown as Item[]);
      });
    });
  }

  private handleError(err: unknown): void {
    if (err instanceof Error) {
      if (err.message === 'HTTP error 500') {
        // Steam for some reason returns 500 when the session expired
        this.botService.webLogOn();
      }
    }
  }

  private isActiveOrThrow(offer: ActualTradeOffer, onlyActive: boolean): void {
    if (onlyActive && offer.state !== ETradeOfferState.Active) {
      throw new BadRequestException('Offer is not active');
    }

    if (
      offer.state !== ETradeOfferState.Active &&
      offer.state !== ETradeOfferState.CreatedNeedsConfirmation
    ) {
      throw new BadRequestException('Offer is not active');
    }
  }

  private mapOffers<T extends Item | Asset>(
    offers: ActualTradeOffer[],
  ): TradeOffer<T>[] {
    return offers.map((offer) => this.mapOffer(offer));
  }

  private mapOffer<T extends Item | Asset>(
    offer: ActualTradeOffer,
  ): TradeOffer<T> {
    assert(offer.id, 'Offer ID is missing');

    return {
      partner: offer.partner.getSteamID64(),
      id: offer.id,
      message: offer.message,
      state: offer.state,
      itemsToGive: offer.itemsToGive as unknown as T[],
      itemsToReceive: offer.itemsToReceive as unknown as T[],
      isGlitched: offer.isGlitched(),
      isOurOffer: offer.isOurOffer,
      createdAt: Math.floor(offer.created.getTime() / 1000),
      updatedAt: Math.floor(offer.updated.getTime() / 1000),
      expiresAt: Math.floor(offer.expires.getTime() / 1000),
      tradeID: offer.tradeID ?? null,
      fromRealTimeTrade: offer.fromRealTimeTrade,
      confirmationMethod: offer.confirmationMethod,
      escrowEndsAt:
        offer.escrowEnds === null
          ? null
          : Math.floor(offer.escrowEnds.getTime() / 1000),
    };
  }

  private getOfferData(id: string): TradeOfferData {
    return this.manager.pollData.offerData?.[id] ?? {};
  }

  private setOfferDataKey<K extends keyof TradeOfferData>(
    id: string,
    key: K,
    value: TradeOfferData[K],
    publish = true,
  ): void {
    const data = this.getOfferData(id);
    data[key] = value;
    this.setOfferData(id, data, publish);
  }

  private setOfferData(id: string, data: TradeOfferData, publish = true): void {
    this.manager.pollData.offerData[id] = data;
    if (publish) {
      this.manager.emit('pollData', this.manager.pollData);
    }
  }
}
