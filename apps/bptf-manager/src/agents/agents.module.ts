import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { BullModule } from '@nestjs/bullmq';
import { defaultJobOptions } from '@tf2-automatic/queue';
import { TokensModule } from '../tokens/tokens.module';
import { RegisterAgentsProcessor } from './processors/register-agents.processor';
import { UnregisterAgentsProcessor } from './processors/unregister-agents.processor';

@Module({
  imports: [
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
  exports: [AgentsService],
})
export class AgentsModule {}
