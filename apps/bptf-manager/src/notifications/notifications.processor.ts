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
    const steamid = new SteamID(job.data.steamid64);

    switch (job.name) {
      case 'done':
        await this.done(job);
        break;
      case 'fetch':
        await this.getNotifications(job);
        break;
    }
  }

  private async done(job: Job<JobData>): Promise<void> {
    this.logger.debug('Refreshed notifications for ' + job.data.steamid64);

    await this.notificationsService.handleNotificationsFetched(job);
  }

  private async getNotifications(job: Job<JobData>): Promise<void> {
    const steamid = new SteamID(job.data.steamid64);

    const token = await this.tokensService.getToken(steamid);

    let debugStr = 'Getting notifications for ' + token.steamid64;

    const skip = job.data.skip;
    const limit = job.data.limit;

    if (skip && limit) {
      debugStr += ' using skip ' + skip + ' and limit ' + limit;
    } else if (skip) {
      debugStr += ' using skip ' + skip;
    } else if (limit) {
      debugStr += ' using limit ' + limit;
    }

    debugStr += '...';

    this.logger.debug(debugStr);

    const response = await this.notificationsService.fetchNotifications(
      token,
      skip,
      limit,
    );

    this.logger.debug(
      'Got notifications response for ' +
        token.steamid64 +
        ' (skip: ' +
        response.cursor.skip +
        ', limit: ' +
        response.cursor.limit +
        ', total: ' +
        response.cursor.total +
        ', results: ' +
        response.results.length +
        ')',
    );

    await this.notificationsService.handleNotifications(job, response);
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
}
