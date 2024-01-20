import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TokensService } from '../tokens/tokens.service';
import SteamID from 'steamid';
import { AxiosError } from 'axios';
import { NotificationsService } from './notifications.service';
import { JobData } from './interfaces/queue';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly tokensService: TokensService,
  ) {
    super();
  }

  async process(job: Job<JobData>): Promise<void> {
    this.logger.debug('Processing job ' + job.id);

    const steamid = new SteamID(job.data.steamid64);

    const token = await this.tokensService.getToken(steamid);

    await this.notificationsService.getNotificationsAndContinue(
      token,
      job.data.time,
      job.data.skip,
      job.data.limit,
    );
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.warn(
      `Failed to get notifications for job ${job.id}: ${err.message}`,
    );

    if (err instanceof AxiosError) {
      console.error('Status code ' + err.response?.status);
      console.error(err.response?.data);
    } else {
      console.error(err);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.debug('Completed job ' + job.id);
  }
}
