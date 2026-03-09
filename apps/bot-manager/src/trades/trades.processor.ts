import { Processor } from '@nestjs/bullmq';
import {
  AcceptConfirmationResponse,
  AcceptTradeResponse,
  CounterTrade,
  CreateTradeResponse,
  DeleteTradeResponse,
  HttpError,
  SteamError,
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
import { AxiosError, AxiosResponse } from 'axios';
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
      .catch((err) => {
        this.handleError(err);
        throw err;
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
  ): Promise<CreateTradeResponse> {
    this.logger.debug(`Checking if a similar offer already offer exists...`);

    const trades = await this.tradesService.getActiveTrades(
      bot,
      job.attemptsMade === 0,
    );

    const matches = this.findMatchingTrades(
      new SteamID(job.data.options.partner),
      job.data.options,
      0,
      trades.sent,
    );

    if (matches.length > 0) {
      this.logger.debug(
        `Found ${matches.length} matching offer${matches.length !== 1 ? 's' : ''} (${matches.map((m) => m.id).join(', ')}), skipping creation`,
      );
      // An identical offer was already created
      return matches[0];
    }

    this.logger.debug(`Did not find a matching offer, creating one...`);

    return this.tradesService.createTrade(bot, job.data.options, job.id);
  }

  private async handleCounterJob(
    job: Job<CounterTradeJob>,
    bot: Bot,
  ): Promise<CreateTradeResponse> {
    const offer = await this.tradesService.getTrade(bot, job.data.options.id);

    if (offer.state !== SteamUser.ETradeOfferState.Active) {
      return this.handleCounterJobButOfferIsNotActive(job, bot, offer);
    }

    this.logger.debug(`Countering trade...`);

    return this.tradesService.counterTrade(bot, job.data.options.id, {
      message: job.data.options.message,
      itemsToGive: job.data.options.itemsToGive,
      itemsToReceive: job.data.options.itemsToReceive,
    });
  }

  private async handleCounterJobButOfferIsNotActive(
    job: Job<CounterTradeJob>,
    bot: Bot,
    offer: TradeOfferWithItems,
  ): Promise<CreateTradeResponse> {
    if (offer.state !== SteamUser.ETradeOfferState.Countered) {
      throw new UnrecoverableError('Offer is not active');
    }

    // Check if offer was created
    this.logger.debug(
      `Checking if a similar offer already offer exists...`,
      job.id,
    );

    const trades = await this.tradesService.getActiveTrades(bot);

    const matches = this.findMatchingTrades(
      new SteamID(offer.partner),
      job.data.options,
      offer.updatedAt,
      trades.sent,
    );

    if (matches.length > 0) {
      // An identical offer was already created
      return matches[0];
    }

    this.logger.debug(`Did not find a matching offer, will create one...`);

    return this.tradesService.createTrade(
      bot,
      {
        partner: offer.partner,
        token: job.data.options.token,
        ...job.data.options,
      },
      job.id,
    );
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

  private handleError(err: Error) {
    if (!(err instanceof AxiosError)) {
      // Unknown error
      throw err;
    }

    if (err.response === undefined) {
      throw err;
    }

    const response: AxiosResponse<SteamError | HttpError | undefined> =
      err.response;

    if (response.data) {
      if (
        response.data.error === 'SteamException' &&
        'eresult' in response.data
      ) {
        if (
          response.data.eresult !== SteamUser.EResult.Timeout &&
          response.data.eresult !== SteamUser.EResult.ServiceUnavailable &&
          response.data.eresult !== SteamUser.EResult.Fail
        ) {
          // Fail when receiving eresult that can't be recovered from
          throw new CustomUnrecoverableError(
            response.data.message,
            response.data,
          );
        }
      } else if (response.status >= 400 && response.status < 500) {
        // Unrecoverable error, don't retry
        throw new CustomUnrecoverableError(
          response.data?.message ?? err.message,
          response.data,
        );
      }

      throw new CustomError(
        response.data.message ?? err.message,
        response.data,
      );
    }
  }

  private findMatchingTrades(
    partner: SteamID,
    trade: CounterTrade,
    time: number,
    trades: TradeOfferWithItems[],
  ): TradeOfferWithItems[] {
    const baseItems = [...trade.itemsToGive, ...trade.itemsToReceive];
    const base = new Set(
      baseItems.map(
        (i) => `${i.appid}:${i.contextid}:${i.assetid}:${i.amount ?? 1}`,
      ),
    );

    const partnerSteamID64 = partner.getSteamID64();

    const matches: TradeOfferWithItems[] = [];

    for (const activeTrade of trades) {
      if (
        !activeTrade.isOurOffer ||
        activeTrade.createdAt < time ||
        activeTrade.partner !== partnerSteamID64 ||
        activeTrade.message !== trade.message
      ) {
        continue;
      }

      const items = [...activeTrade.itemsToGive, ...activeTrade.itemsToReceive];

      if (items.length !== base.size) {
        continue;
      }

      let valid = true;

      for (const item of items) {
        const key = `${item.appid}:${item.contextid}:${item.assetid}:${item.amount ?? 1}`;
        if (!base.has(key)) {
          valid = false;
          break;
        }
      }

      if (valid) {
        matches.push(activeTrade);
      }
    }

    matches.sort((a, b) => a.createdAt - b.createdAt);

    return matches;
  }
}
