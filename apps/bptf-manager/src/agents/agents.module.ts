import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { BullModule } from '@nestjs/bullmq';
import { DefaultJobOptions } from 'bullmq';
import { HttpModule } from '@nestjs/axios';
import { TokensModule } from '../tokens/tokens.module';
import { RegisterAgentsProcessor } from './processors/register-agents.processor';
import { UnregisterAgentsProcessor } from './processors/unregister-agents.processor';

const defaultJobOptions: DefaultJobOptions = {
  attempts: Number.MAX_SAFE_INTEGER,
  backoff: {
    type: 'exponential',
    delay: 100,
  },
  removeOnComplete: true,
  removeOnFail: true,
};

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({ name: 'registerAgents', defaultJobOptions }),
    BullModule.registerQueue({ name: 'unregisterAgents', defaultJobOptions }),
    TokensModule,
  ],
  providers: [
    AgentsService,
    RegisterAgentsProcessor,
    UnregisterAgentsProcessor,
  ],
  controllers: [AgentsController],
})
export class AgentsModule {}
