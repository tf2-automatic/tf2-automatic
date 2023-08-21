import { Module } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { ManageListingsProcessor } from './processors/manage-listings.processor';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { TokensModule } from '../tokens/tokens.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({
      name: 'manage-listings',
      defaultJobOptions: {
        attempts: Number.MAX_SAFE_INTEGER,
        backoff: {
          type: 'exponential',
          delay: 500,
        },
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
    TokensModule,
    AgentsModule,
  ],
  providers: [ListingsService, ManageListingsProcessor],
  controllers: [ListingsController],
})
export class ListingsModule {}
