import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  botAttemptErrorHandler,
  bullWorkerSettings,
  CustomJob,
  CustomUnrecoverableError,
  CustomWorkerHost,
  selectBot,
} from '@tf2-automatic/queue';
import { ClsService } from 'nestjs-cls';
import { EscrowJobData } from './escrow.types';
import { EscrowService } from './escrow.service';
import SteamID from 'steamid';
import { Bot } from '@tf2-automatic/bot-manager-data';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';

@Processor('escrow', {
  settings: bullWorkerSettings,
  limiter: {
    max: 1,
    duration: 1000,
  },
})
export class EscrowProcessor extends CustomWorkerHost<EscrowJobData> {
  constructor(
    private readonly escrowService: EscrowService,
    private readonly heartbeatsService: HeartbeatsService,
    private readonly cls: ClsService,
  ) {
    super(cls);
  }

  async errorHandler(
    job: CustomJob<EscrowJobData>,
    err: unknown,
  ): Promise<void> {
    return botAttemptErrorHandler(this.cls, err, job);
  }

  async processJob(job: Job<EscrowJobData>): Promise<void> {
    const bot = await this.selectBot(job);

    this.logger.debug(`Bot ${bot.steamid64} selected`);

    this.cls.set('bot', bot.steamid64);

    const result = await this.escrowService.getEscrowFromBot(
      bot,
      new SteamID(job.data.options.steamid64),
      job.data.options.token,
    );

    await this.escrowService.saveEscrow(
      new SteamID(job.data.options.steamid64),
      {
        timestamp: this.cls.get('timestamp'),
        error: null,
        result,
        bot: this.cls.get('bot'),
        token: job.data.options.token,
      },
    );
  }

  private async selectBot(job: CustomJob<EscrowJobData>): Promise<Bot> {
    if (job.data.bot) {
      const botSteamID = new SteamID(job.data.bot);

      return this.heartbeatsService.getBot(botSteamID).catch((err) => {
        throw new Error(err.message);
      });
    }

    // Get list of bots
    const bots = await this.heartbeatsService.getRunningBots();

    return selectBot(job, bots);
  }
}
