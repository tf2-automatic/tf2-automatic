import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  EXCHANGE_DETAILS_EVENT,
  ExchangeDetailsEvent,
} from '@tf2-automatic/bot-manager-data';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import {
  bullWorkerSettings,
  CustomWorkerHost,
  errorToEvent,
} from '@tf2-automatic/queue';
import { ClsService } from 'nestjs-cls';
import SteamID from 'steamid';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';
import { TradesService } from './trades.service';
import { ExchangeDetailsJobData } from './trades.types';

@Processor('exchange-details', {
  settings: bullWorkerSettings,
})
export class ExchangeDetailsProcessor extends CustomWorkerHost<ExchangeDetailsJobData> {
  constructor(
    private readonly tradesService: TradesService,
    private readonly heartbeatsService: HeartbeatsService,
    private readonly eventsService: NestEventsService,
    cls: ClsService,
  ) {
    super(cls);
  }

  async processJob(job: Job<ExchangeDetailsJobData>): Promise<void> {
    const { offer } = job.data.options;
    const steamid = new SteamID(job.data.bot);

    // getBot throws HttpExceptions, which the queue would treat as unrecoverable
    const bot = await this.heartbeatsService.getBot(steamid).catch((err) => {
      throw new Error(err.message);
    });

    const details = await this.tradesService.getExchangeDetails(
      bot,
      offer.id,
      true,
    );

    await this.eventsService.publish(
      EXCHANGE_DETAILS_EVENT,
      { offer, details } satisfies ExchangeDetailsEvent['data'],
      steamid,
    );
  }

  async onJobFailed(
    job: Job<ExchangeDetailsJobData>,
    err: unknown,
  ): Promise<void> {
    const { unrecoverable, error } = errorToEvent(err);
    if (unrecoverable) {
      this.logger.warn(
        `Giving up on exchange details for offer ${job.data.options.offer.id}: ${error}`,
      );
    }
  }
}
