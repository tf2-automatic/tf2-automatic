import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ManageListingsProcessor } from './processors/manage-listings.processor';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { TokensModule } from '../tokens/tokens.module';
import { AgentsModule } from '../agents/agents.module';
import { ListingLimitsProcessor } from './processors/listing-limits.processor';
import { ManageListingsService } from './manage-listings.service';
import { DesiredListingsService } from './desired-listings.service';
import { CurrentListingsService } from './current-listings.service';
import { ListingLimitsService } from './listing-limits.service';

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
    BullModule.registerQueue({
      name: 'listing-limits',
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
  providers: [
    DesiredListingsService,
    CurrentListingsService,
    ManageListingsService,
    ListingLimitsService,
    ManageListingsProcessor,
    ListingLimitsProcessor,
  ],
  controllers: [ListingsController],
})
export class ListingsModule {}
