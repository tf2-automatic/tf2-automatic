import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  CreateTrade,
  HttpError,
  SteamError,
  TradeOffer,
} from '@tf2-automatic/bot-data';
import {
  Bot,
  TRADE_ERROR_EVENT,
  TRADE_FAILED_EVENT,
  TradeErrorEvent,
  TradeFailedEvent,
} from '@tf2-automatic/bot-manager-data';
import { AxiosError } from 'axios';
import { Job, MinimalJob, UnrecoverableError } from 'bullmq';
import SteamUser from 'steam-user';
import SteamID from 'steamid';
import { HeartbeatsService } from '../../heartbeats/heartbeats.service';
import {
  CounterTradeJob,
  CreateTradeJob,
  TradeQueue,
} from '../interfaces/trade-queue.interface';
import { TradesService } from '../trades.service';
import { customBackoffStrategy } from '../../common/utils/backoff-strategy';
import { EventsService } from '../../events/events.service';
import {
  CustomError,
  CustomUnrecoverableError,
} from '../../common/utils/custom-queue-errors';

@Processor('trades', {
  settings: {
    backoffStrategy: (attempts: number, _, __, job: MinimalJob) => {
      return customBackoffStrategy(attempts, job);
    },
  },
  limiter: {
    max: 5,
    duration: 5000,
  },
})
export class TradesProcessor extends WorkerHost {
  private readonly logger = new Logger(TradesProcessor.name);

  constructor(
    private readonly tradesService: TradesService,
    private readonly heartbeatsService: HeartbeatsService,
    private readonly eventsService: EventsService
  ) {
    super();
  }

  async process(job: Job<TradeQueue>): Promise<unknown> {
    this.logger.log(
      `Processing job ${job.data.type} ${job.id} attempt #${job.attemptsMade}...`
    );

    return this.processJobWithErrorHandler(job).catch((err) => {
      const data: (TradeErrorEvent | TradeFailedEvent)['data'] = {
        job: this.tradesService.mapJob(job),
        error: err.message,
        response: null,
      };

      if (
        err instanceof CustomError ||
        err instanceof CustomUnrecoverableError
      ) {
        data.response = err.response.data;
      }

      const unrecoverable = err instanceof UnrecoverableError;

      return this.eventsService
        .publish(
          unrecoverable ? TRADE_ERROR_EVENT : TRADE_FAILED_EVENT,
          data,
          new SteamID(job.data.bot)
        )
        .finally(() => {
          throw err;
        });
    });
  }

  private async processJobWithErrorHandler(
    job: Job<TradeQueue>
  ): Promise<unknown> {
    const maxTime = job.data?.retry?.maxTime ?? 120000;

    // Check if job is too old
    if (job.timestamp < Date.now() - maxTime) {
      throw new UnrecoverableError('Job is too old');
    }

    try {
      // Work on job
      const result = await this.handleJob(job);
      return result;
    } catch (err) {
      if (err instanceof AxiosError) {
        const response =
          err.response satisfies AxiosError<HttpError>['response'];

        if (
          response !== undefined &&
          response.status < 500 &&
          response.status >= 400
        ) {
          // Don't retry on 4xx errors
          throw new CustomUnrecoverableError(response.data.message, response);
        }
      }

      // Check if job will be too old when it can be retried again
      const delay = customBackoffStrategy(job.attemptsMade, job);
      if (job.timestamp < Date.now() + delay - maxTime) {
        if (err instanceof AxiosError && err.response !== undefined) {
          // Is axios error, throw custom unrecoverable error with axios response
          throw new CustomUnrecoverableError(
            'Job is too old to be retried',
            err.response
          );
        }

        // Is not axios error, throw normal unrecoverable error
        throw new UnrecoverableError('Job is too old to be retried');
      }

      if (err instanceof AxiosError && err.response !== undefined) {
        // Not a unrecoverable error, and is an axios error, throw custom error with axios response
        throw new CustomError(err.response.data.message, err.response);
      }

      // Unknown error
      throw err;
    }
  }

  private async handleJob(job: Job<TradeQueue>): Promise<unknown> {
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
        return this.tradesService.deleteTrade(bot, job.data.raw);
      case 'ACCEPT':
        return this.tradesService.acceptTrade(bot, job.data.raw);
      case 'CONFIRM':
        return this.tradesService.confirmTrade(bot, job.data.raw);
      default:
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        throw new UnrecoverableError(`Unknown job type ${job.data.type}`);
    }
  }

  private async handleCreateJob(
    job: Job<CreateTradeJob>,
    bot: Bot
  ): Promise<string> {
    if (job.data.extra.checkCreatedAfter !== undefined) {
      // Check if offer was created
      this.logger.debug(
        `Checking if a similar offer already offer exists...`,
        job.id
      );

      const trades = await this.tradesService.getActiveTrades(bot);

      const offer = this.findMatchingTrade(
        job.data.raw,
        job.data.extra.checkCreatedAfter,
        trades.sent
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

      const offer = await this.tradesService.createTrade(bot, job.data.raw);
      return offer.id;
    } catch (err) {
      await this.handleSendTradeError(job, err, now);
      throw err;
    }
  }

  private async handleCounterJob(
    job: Job<CounterTradeJob>,
    bot: Bot
  ): Promise<string> {
    const offer = await this.tradesService.getTrade(bot, job.data.raw.id);

    if (offer.state !== SteamUser.ETradeOfferState.Active) {
      throw new UnrecoverableError('Offer is not active');
    }

    const now = Date.now();

    try {
      this.logger.debug(`Countering trade...`);

      const offer = await this.tradesService.counterTrade(
        bot,
        job.data.raw.id,
        {
          message: job.data.raw.message,
          itemsToGive: job.data.raw.itemsToGive,
          itemsToReceive: job.data.raw.itemsToReceive,
        }
      );
      return offer.id;
    } catch (err) {
      await this.handleSendTradeError(job, err, now);
      throw err;
    }
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
          job.data.extra.checkCreatedAfter = Math.floor(now / 1000);
          await job.update(job.data);
        } else if (
          data.eresult !== SteamUser.EResult.ServiceUnavailable &&
          data.eresult !== SteamUser.EResult.Fail
        ) {
          // Fail when receiving eresult that can't be recovered from
          throw new CustomUnrecoverableError(data.message, response);
        }
      }
    }
  }

  private findMatchingTrade(
    trade: CreateTrade,
    time: number,
    trades: TradeOffer[]
  ): TradeOffer | null {
    // Get trades created after specific time
    const itemsInTrade = trade.itemsToGive.concat(trade.itemsToReceive);

    const filtered = trades.filter((activeTrade) => {
      if (activeTrade.createdAt < time) {
        // Trade was created before specified time
        return false;
      } else if (trade.partner !== activeTrade.partner) {
        // Trade partner is different
        return false;
      } else if (trade.message !== activeTrade.message) {
        // Trade message is different
        return false;
      }

      const itemsInActiveTrade = activeTrade.itemsToGive.concat(
        activeTrade.itemsToReceive
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
            item.amount === item2.amount
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

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<TradeQueue>, err: Error): void {
    this.logger.warn(`Failed job ${job.id}: ${err.message}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<TradeQueue>): void {
    this.logger.log(`Completed job ${job.id}`);
  }
}
