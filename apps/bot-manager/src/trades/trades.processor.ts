import { Processor } from '@nestjs/bullmq';
import {
  AcceptConfirmationResponse,
  AcceptTradeResponse,
  CounterTrade,
  CreateTradeResponse,
  DeleteTradeResponse,
  SteamError,
  TradeOfferWithAssets,
  TradeOfferWithItems,
} from '@tf2-automatic/bot-data';
import {
  Bot,
  TRADE_COMPLETED_EVENT,
  TRADE_ERROR_EVENT,
  TRADE_FAILED_EVENT,
  TradeCompletedEvent,
  TradeErrorEvent,
  TradeFailedEvent,
} from '@tf2-automatic/bot-manager-data';
import { AxiosError } from 'axios';
import { Job, UnrecoverableError } from 'bullmq';
import SteamUser from 'steam-user';
import SteamID from 'steamid';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';
import {
  AcceptTradeJob,
  ConfirmTradeJob,
  CounterTradeJob,
  CreateTradeJob,
  DeleteTradeJob,
  TradeQueue,
} from './trades.types';
import { TradesService } from './trades.service';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import {
  bullWorkerSettings,
  CustomError,
  CustomUnrecoverableError,
  CustomWorkerHost,
} from '@tf2-automatic/queue';
import { ClsService } from 'nestjs-cls';

@Processor('trades', {
  settings: bullWorkerSettings,
  limiter: {
    max: 5,
    duration: 5000,
  },
})
export class TradesProcessor extends CustomWorkerHost<TradeQueue> {
  constructor(
    private readonly tradesService: TradesService,
    private readonly heartbeatsService: HeartbeatsService,
    private readonly eventsService: NestEventsService,
    cls: ClsService,
  ) {
    super(cls);
  }

  async processJob(job: Job<TradeQueue>): Promise<unknown> {
    return this.handleJob(job)
      .then((response) => {
        const data: TradeCompletedEvent['data'] = {
          job: this.tradesService.mapJob(job),
          response,
        };

        return this.eventsService.publish(
          TRADE_COMPLETED_EVENT,
          data,
          new SteamID(job.data.bot),
        );
      })
      .catch(async (err) => {
        const data: (TradeErrorEvent | TradeFailedEvent)['data'] = {
          job: this.tradesService.mapJob(job),
          error: err.message,
          response: null,
        };

        if (
          err instanceof CustomError ||
          err instanceof CustomUnrecoverableError
        ) {
          data.response = err.response;
        }

        const unrecoverable = err instanceof UnrecoverableError;

        return this.eventsService
          .publish(
            unrecoverable ? TRADE_ERROR_EVENT : TRADE_FAILED_EVENT,
            data,
            new SteamID(job.data.bot),
          )
          .finally(() => {
            throw err;
          });
      });
  }

  private async handleJob(job: Job<TradeQueue>) {
    const botSteamID = new SteamID(job.data.bot);

    this.logger.debug(`Getting bot ${botSteamID.getSteamID64()}...`);

    const bot = await this.heartbeatsService.getBot(botSteamID).catch((err) => {
      throw new Error(err.message);
    });

    switch (job.data.type) {
      case 'CREATE':
        return this.handleCreateJob(job as Job<CreateTradeJob>, bot);
      case 'COUNTER':
        return this.handleCounterJob(job as Job<CounterTradeJob>, bot);
      case 'DELETE':
        return this.handleDeleteJob(job as Job<DeleteTradeJob>, bot);
      case 'ACCEPT':
        return this.handleAcceptJob(job as Job<AcceptTradeJob>, bot);
      case 'CONFIRM':
        return this.handleConfirmJob(job as Job<ConfirmTradeJob>, bot);
      case 'REFRESH':
        return this.refreshTrade(bot, job.data.options);
      default:
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        throw new UnrecoverableError(`Unknown job type ${job.data.type}`);
    }
  }

  private async refreshTrade(
    bot: Bot,
    id: string,
  ): Promise<TradeOfferWithItems> {
    const offer = await this.tradesService.refreshTrade(bot, id);

    // Throws error if trade is glitched. This will be caught by the error handler
    // and the processor will then retry the job
    if (offer.isGlitched) {
      throw new Error('Trade offer is glitched');
    }

    return offer;
  }

  private async handleCreateJob(
    job: Job<CreateTradeJob>,
    bot: Bot,
  ): Promise<string> {
    if (job.data.state.checkCreatedAfter !== undefined) {
      // Check if offer was created
      this.logger.debug(
        `Checking if a similar offer already offer exists...`,
        job.id,
      );

      const trades = await this.tradesService.getActiveTrades(bot);

      const offer = this.findMatchingTrade(
        job.data.options,
        job.data.state.checkCreatedAfter,
        trades.sent,
      );

      if (offer) {
        // Offer was already created
        return offer.id;
      }

      this.logger.debug(`Did not find a matching offer`);
    }

    const now = Date.now();

    try {
      this.logger.debug(`Creating trade...`);

      const offer = await this.tradesService.createTrade(
        bot,
        job.data.options,
        job.id,
      );
      return offer.id;
    } catch (err) {
      await this.handleSendTradeError(job, err, now);
      throw err;
    }
  }

  private async handleCounterJob(
    job: Job<CounterTradeJob>,
    bot: Bot,
  ): Promise<CreateTradeResponse> {
    const offer = await this.tradesService.getTrade(
      bot,
      job.data.options.id,
      true,
    );

    if (offer.state !== SteamUser.ETradeOfferState.Active) {
      throw new UnrecoverableError('Offer is not active');
    }

    const now = Date.now();

    this.logger.debug(`Countering trade...`);

    return this.tradesService
      .counterTrade(bot, job.data.options.id, {
        message: job.data.options.message,
        itemsToGive: job.data.options.itemsToGive,
        itemsToReceive: job.data.options.itemsToReceive,
      })
      .catch(async (err) => {
        await this.handleSendTradeError(job, err, now);
        throw err;
      });
  }

  private async handleDeleteJob(
    job: Job<DeleteTradeJob>,
    bot: Bot,
  ): Promise<DeleteTradeResponse> {
    return this.tradesService
      .deletedTrade(bot, job.data.options)
      .then((check) => {
        if (!check.deleted) {
          return this.tradesService.deleteTrade(bot, job.data.options);
        } else {
          return this.tradesService.getTrade(bot, job.data.options, true);
        }
      });
  }

  private async handleAcceptJob(
    job: Job<AcceptTradeJob>,
    bot: Bot,
  ): Promise<AcceptTradeResponse> {
    return this.tradesService
      .acceptedTrade(bot, job.data.options)
      .then((check) => {
        if (!check.accepted) {
          return this.tradesService.acceptTrade(bot, job.data.options);
        } else {
          return this.tradesService.getTrade(bot, job.data.options, true);
        }
      });
  }

  private async handleConfirmJob(
    job: Job<ConfirmTradeJob>,
    bot: Bot,
  ): Promise<AcceptConfirmationResponse> {
    return this.tradesService
      .confirmedTrade(bot, job.data.options)
      .then((check) => {
        if (!check.confirmed) {
          return this.tradesService.confirmTrade(bot, job.data.options);
        } else {
          return this.tradesService.getTrade(bot, job.data.options, true);
        }
      });
  }

  private async handleSendTradeError(job: Job, err: Error, now: number) {
    if (!(err instanceof AxiosError)) {
      // Unknown error
      throw err;
    }

    const response = err.response;

    if (response) {
      if (response.data.error === 'SteamException') {
        const data = response.data as SteamError;

        if (data.eresult === SteamUser.EResult.Timeout) {
          // Add time to job data it as a potentially active offer and to check if it was created
          job.data.state.checkCreatedAfter = Math.floor(now / 1000);
          await job.updateData(job.data);
        } else if (
          data.eresult !== SteamUser.EResult.ServiceUnavailable &&
          data.eresult !== SteamUser.EResult.Fail
        ) {
          // Fail when receiving eresult that can't be recovered from
          throw new CustomUnrecoverableError(data.message, response.data);
        }
      }
    }
  }

  private findMatchingTrade(
    trade: CreateTrade,
    time: number,
    trades: TradeOfferWithItems[],
  ): TradeOfferWithItems | null {
    // Get trades created after specific time
    const itemsInTrade = trade.itemsToGive.concat(trade.itemsToReceive);

    const filtered = trades.filter((activeTrade) => {
      if (
        !activeTrade.isOurOffer ||
        activeTrade.createdAt < time ||
        trade.partner !== activeTrade.partner ||
        trade.message !== activeTrade.message
      ) {
        // Trade was created before specified time, trade partner is different,
        // or trade message is different
        return false;
      }

      const itemsInActiveTrade = activeTrade.itemsToGive.concat(
        activeTrade.itemsToReceive,
      );

      // Check if the amount of items is the same
      if (itemsInTrade.length !== itemsInActiveTrade.length) {
        return false;
      }

      // Check if the items are the same
      for (const item of itemsInTrade) {
        const match = itemsInActiveTrade.find(
          (item2) =>
            item.assetid === item2.assetid &&
            item.appid === item2.appid &&
            item.contextid === item2.contextid &&
            item.amount === item2.amount,
        );
        if (match === undefined) {
          return false;
        }
      }

      return true;
    });

    // There might be more than one matching trade but there shouldn't be
    return filtered.length === 0 ? null : filtered[0];
  }
}
