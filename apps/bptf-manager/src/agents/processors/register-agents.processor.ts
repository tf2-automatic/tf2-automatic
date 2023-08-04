import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import SteamID from 'steamid';
import { TokensService } from '../../tokens/tokens.service';
import { AgentsService } from '../agents.service';
import { AgentJobData } from '../interfaces/queue.interface';

@Processor('registerAgents')
export class RegisterAgentsProcessor extends WorkerHost {
  private readonly logger = new Logger(RegisterAgentsProcessor.name);

  constructor(
    private readonly agentsService: AgentsService,
    private readonly tokensService: TokensService,
  ) {
    super();
  }

  async process(job: Job<AgentJobData>): Promise<void> {
    const steamid = new SteamID(job.data.steamid64);

    const isRegistering = await this.agentsService.isRegistering(steamid);

    if (!isRegistering) {
      this.logger.debug(
        `Skipping registering agent for ${job.data.steamid64} because it is no longer needed`,
      );
      return;
    }

    this.logger.debug(
      `Registering agent for ${job.data.steamid64} attempt #${job.attemptsMade}...`,
    );

    const token = await this.tokensService.getToken(steamid);

    await this.agentsService.registerAgent(token);
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
    const steamid = new SteamID(job.data.steamid64);

    // Check if the agent still needs to run
    this.agentsService
      .isRegistering(steamid)
      .then((registering) => {
        if (!registering) {
          // Remove the agent from the queue
          return this.agentsService.cleanupAndUnregisterAgent(steamid);
        }

        this.logger.log(`Registered agent for ${job.data.steamid64}`);
      })
      .catch((err) => {
        this.logger.warn(`Error while unregistering agent: ${err.message}`);
      });
  }
}
