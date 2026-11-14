import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { ClsService } from 'nestjs-cls';
import { AccountWorkerHost } from '../../common/account-worker-host';
import { bullWorkerSettings } from '@tf2-automatic/queue';
import { Logger, NotFoundException } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import SteamID from 'steamid';
import { TokensService } from '../../tokens/tokens.service';
import { AgentsService } from '../agents.service';
import { AgentJobData } from '../interfaces/queue.interface';

// A missing token is not transient, so fail once instead of retrying
export function failWithoutToken(err: unknown): never {
  throw err instanceof NotFoundException
    ? new UnrecoverableError(err.message)
    : err;
}

@Processor('registerAgents', {
  settings: bullWorkerSettings,
})
export class RegisterAgentsProcessor extends AccountWorkerHost {
  private readonly logger = new Logger(RegisterAgentsProcessor.name);

  constructor(
    private readonly agentsService: AgentsService,
    private readonly tokensService: TokensService,
    cls: ClsService,
  ) {
    super(cls);
  }

  async processJob(job: Job<AgentJobData>): Promise<void> {
    const steamid = new SteamID(job.data.steamid64);

    const agent = await this.agentsService.getAgent(steamid);

    if (!agent) {
      this.logger.debug(
        'Skipping registering agent because it is no longer needed',
      );
      return;
    }

    const token = await this.tokensService
      .getToken(steamid)
      .catch(failWithoutToken);

    await this.agentsService.registerAgent(token, agent.userAgent ?? undefined);
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.warn(`Failed to register agent: ${err.message}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    const steamid = new SteamID(job.data.steamid64);

    // Check if the agent still needs to run
    this.agentsService
      .getAgent(steamid)
      .then((agent) => {
        if (!agent) {
          // Remove the agent from the queue
          return this.agentsService.cleanupAndUnregisterAgent(steamid);
        }

        this.logger.debug('Registered agent');
      })
      .catch((err) => {
        this.logger.warn(`Error while unregistering agent: ${err.message}`);
      });
  }
}
