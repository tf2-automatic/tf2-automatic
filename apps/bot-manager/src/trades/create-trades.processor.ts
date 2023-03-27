import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { SteamError, TradeOffer } from '@tf2-automatic/bot-data';
import { QueueTrade } from '@tf2-automatic/bot-manager-data';
import { AxiosError } from 'axios';
import { Job, MinimalJob, UnrecoverableError } from 'bullmq';
import SteamUser from 'steam-user';
import SteamID from 'steamid';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';
import { CreateJobQueue } from './interfaces/create-job-queue.interface';
import { TradesService } from './trades.service';

type BackoffStrategy = (
  attemptsMade: number,
  job: MinimalJob<CreateJobQueue>
) => number;

const customBackoffStrategy: BackoffStrategy = (attemptsMade, job) => {
  return Math.min(
    attemptsMade * job.data.options.retryDelay,
    job.data.options.maxRetryDelay
  );
};

@Processor('createTrades', {
  settings: {
    backoffStrategy: (attemptsMade: number, _, __, job: MinimalJob) => {
      return customBackoffStrategy(attemptsMade, job);
    },
  },
})
export class CreateTradesProcessor extends WorkerHost {
  private readonly logger = new Logger(CreateTradesProcessor.name);

  constructor(
    private readonly tradesService: TradesService,
    private readonly heartbeatsService: HeartbeatsService
  ) {
    super();
  }

  async process(job: Job<CreateJobQueue>): Promise<string> {
    this.logger.log(
      `Processing trade ${job.id} with ${job.data.data.trade.partner} and bot ${job.data.data.trade.bot}...`
    );

    // Check if job is too old
    if (job.timestamp < Date.now() - job.data.options.retryFor) {
      throw new UnrecoverableError('Job is too old');
    }

    try {
      // Work on job
      return this.handleJob(job);
    } catch (err) {
      // Check if job will be too old when it can be retried again
      const delay = customBackoffStrategy(job.attemptsMade, job);
      if (job.timestamp < Date.now() + delay - job.data.options.retryFor) {
        throw new UnrecoverableError('Job is too old to be retried');
      }

      // Unknown error
      throw err;
    }
  }

  private async handleJob(job: Job<CreateJobQueue>): Promise<string> {
    const botSteamID = new SteamID(job.data.data.trade.bot);

    this.logger.debug(`Getting bot ${botSteamID.getSteamID64()}...`);

    const bot = await this.heartbeatsService.getBot(botSteamID);

    if (job.data.data.checkCreatedAfter !== undefined) {
      // Check if offer was created
      this.logger.debug(
        `Checking if a similar offer already offer exists...`,
        job.id
      );

      const trades = await this.tradesService.getActiveTrades(bot);

      const offer = this.findMatchingTrade(
        job.data.data.trade,
        job.data.data.checkCreatedAfter,
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

      const offer = await this.tradesService.createTrade(
        bot,
        job.data.data.trade
      );
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
            job.data.data.checkCreatedAfter = Math.floor(now / 1000);
            await job.update(job.data);
          } else if (
            data.eresult !== SteamUser.EResult.ServiceUnavailable &&
            data.eresult !== SteamUser.EResult.Fail
          ) {
            // Fail when receiving eresult that can't be recovered from
            throw new UnrecoverableError(data.message);
          }
        } else if (response.status <= 500 && response.status >= 400) {
          // Don't retry on 4xx errors
          throw new UnrecoverableError(response.data.message);
        }
      }

      throw err;
    }
  }

  private findMatchingTrade(
    trade: QueueTrade,
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
  onError(): void {
    // Do nothing
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CreateJobQueue>, err: Error): void {
    this.logger.warn(`Failed to process trade ${job.id}: ${err.message}`);
    if (err instanceof AxiosError && err.response) {
      console.log(err.response.data);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<CreateJobQueue>): void {
    this.logger.log(`Completed trade ${job.id} sent offer #${job.returnvalue}`);
  }
}
