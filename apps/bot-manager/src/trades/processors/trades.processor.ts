import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  CreateTrade,
  HttpError,
  SteamError,
  TradeOffer,
} from '@tf2-automatic/bot-data';
import { Bot } from '@tf2-automatic/bot-manager-data';
import { AxiosError } from 'axios';
import { Job, MinimalJob, UnrecoverableError } from 'bullmq';
import SteamUser from 'steam-user';
import SteamID from 'steamid';
import { HeartbeatsService } from '../../heartbeats/heartbeats.service';
import {
  AcceptTradeJob,
  ConfirmTradeJob,
  CreateTradeJob,
  DeleteTradeJob,
  TradeQueue,
} from '../interfaces/trade-queue.interface';
import { TradesService } from '../trades.service';

type BackoffStrategy = (
  attemptsMade: number,
  job: MinimalJob<TradeQueue>
) => number;

const customBackoffStrategy: BackoffStrategy = (attempts, job) => {
  const strategy = job.data.retry?.strategy ?? 'exponential';
  const delay = job.data.retry?.delay ?? 1000;
  const maxDelay = job.data.retry?.maxDelay ?? 10000;

  let wait = delay;

  if (strategy === 'exponential') {
    wait = 2 ** (attempts - 1) * delay;
  } else if (strategy === 'linear') {
    wait = attempts * delay;
  }

  return Math.min(wait, maxDelay);
};

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
    private readonly heartbeatsService: HeartbeatsService
  ) {
    super();
  }

  async process(job: Job<TradeQueue>): Promise<unknown> {
    this.logger.log(
      `Processing job ${job.data.type} ${job.id} attempt #${job.attemptsMade}...`
    );

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
          response.status <= 500 &&
          response.status >= 400
        ) {
          // Don't retry on 4xx errors
          throw new UnrecoverableError(response.data.message);
        }
      }

      // Check if job will be too old when it can be retried again
      const delay = customBackoffStrategy(job.attemptsMade, job);
      if (job.timestamp < Date.now() + delay - maxTime) {
        throw new UnrecoverableError('Job is too old to be retried');
      }

      // Unknown error
      throw err;
    }
  }

  private async handleJob(job: Job<TradeQueue>): Promise<unknown> {
    const botSteamID = new SteamID(job.data.bot);

    this.logger.debug(`Getting bot ${botSteamID.getSteamID64()}...`);

    const bot = await this.heartbeatsService.getBot(botSteamID);

    switch (job.data.type) {
      case 'CREATE':
        return this.handleCreateJob(job as Job<CreateTradeJob>, bot);
      case 'DELETE':
        return this.handleDeleteJob(job as Job<DeleteTradeJob>, bot);
      case 'ACCEPT':
        return this.handleAcceptJob(job as Job<AcceptTradeJob>, bot);
      case 'CONFIRM':
        return this.handleConfirmJob(job as Job<ConfirmTradeJob>, bot);
      default:
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        throw new Error(`Unknown job type ${job.data.type}`);
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
            throw new UnrecoverableError(data.message);
          }
        }
      }

      throw err;
    }
  }

  private handleDeleteJob(job: Job<DeleteTradeJob>, bot: Bot): Promise<void> {
    return this.tradesService.deleteTrade(bot, job.data.raw);
  }

  private handleAcceptJob(job: Job<AcceptTradeJob>, bot: Bot): Promise<void> {
    return this.tradesService.acceptTrade(bot, job.data.raw);
  }

  private handleConfirmJob(job: Job<ConfirmTradeJob>, bot: Bot): Promise<void> {
    return this.tradesService.confirmTrade(bot, job.data.raw);
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
