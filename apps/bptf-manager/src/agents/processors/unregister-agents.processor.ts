import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { ClsService } from 'nestjs-cls';
import { AccountWorkerHost } from '../../common/account-worker-host';
import { bullWorkerSettings } from '@tf2-automatic/queue';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import SteamID from 'steamid';
import { AgentsService } from '../agents.service';
import { AgentJobData } from '../interfaces/queue.interface';
import { failWithoutToken } from './register-agents.processor';

@Processor('unregisterAgents', {
  settings: bullWorkerSettings,
})
export class UnregisterAgentsProcessor extends AccountWorkerHost {
  private readonly logger = new Logger(UnregisterAgentsProcessor.name);

  constructor(
    private readonly agentsService: AgentsService,
    cls: ClsService,
  ) {
    super(cls);
  }

  async processJob(job: Job<AgentJobData>): Promise<void> {
    const steamid = new SteamID(job.data.steamid64);

    const agent = await this.agentsService.getAgent(steamid);

    if (agent) {
      this.logger.debug(
        'Skipping unregistering agent because it is no longer needed',
      );
      return;
    }

    this.logger.debug(`Unregistering agent attempt #${job.attemptsMade}...`);

    await this.agentsService
      .cleanupAndUnregisterAgent(steamid)
      .catch(failWithoutToken);
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.warn(`Failed to unregister agent: ${err.message}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(): void {
    this.logger.log('Unregistered agent');
  }
}
