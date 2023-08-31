import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import SteamID from 'steamid';
import { AgentsService } from '../agents.service';
import { AgentJobData } from '../interfaces/queue.interface';

@Processor('unregisterAgents')
export class UnregisterAgentsProcessor extends WorkerHost {
  private readonly logger = new Logger(UnregisterAgentsProcessor.name);

  constructor(private readonly agentsService: AgentsService) {
    super();
  }

  async process(job: Job<AgentJobData>): Promise<void> {
    const steamid = new SteamID(job.data.steamid64);

    const isRegistering = await this.agentsService.isRegistering(steamid);

    if (isRegistering) {
      this.logger.debug(
        `Skipping unregistering agent for ${job.data.steamid64} because it is no longer needed`,
      );
      return;
    }

    this.logger.debug(
      `Unregistering agent for ${job.data.steamid64} attempt #${job.attemptsMade}...`,
    );

    await this.agentsService.cleanupAndUnregisterAgent(steamid);
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.warn(
      `Failed to register agent for ${job.data.steamid64}: ${err.message}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(`Unregistered agent for ${job.data.steamid64}`);
  }
}
