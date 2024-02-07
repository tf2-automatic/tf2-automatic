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
import { InventoriesModule } from '../inventories/inventories.module';
import { DefaultJobOptions } from 'bullmq';
import { GetListingsProcessor } from './processors/get-listings.processor';
import { DesiredListingsListener } from './listeners/desired-listings.listener';

const defaultJobOptions: DefaultJobOptions = {
  attempts: Number.MAX_SAFE_INTEGER,
  backoff: {
    type: 'exponential',
    delay: 500,
  },
  removeOnComplete: true,
  removeOnFail: true,
};

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({
      name: 'manage-listings',
      defaultJobOptions,
    }),
    BullModule.registerQueue({
      name: 'listing-limits',
      defaultJobOptions,
    }),
    BullModule.registerQueue({
      name: 'get-listings',
      defaultJobOptions,
    }),
    TokensModule,
    AgentsModule,
    InventoriesModule,
  ],
  providers: [
    DesiredListingsService,
    CurrentListingsService,
    ManageListingsService,
    ListingLimitsService,
    ManageListingsProcessor,
    ListingLimitsProcessor,
    GetListingsProcessor,
    DesiredListingsListener,
  ],
  controllers: [ListingsController],
})
export class ListingsModule {}
