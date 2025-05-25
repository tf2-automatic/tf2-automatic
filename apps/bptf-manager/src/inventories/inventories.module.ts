import { Module } from '@nestjs/common';
import { InventoriesService } from './inventories.service';
import { InventoriesController } from './inventories.controller';
import { BullModule } from '@nestjs/bullmq';
import { InventoriesProcessor } from './processors/inventories.processor';
import { TokensModule } from '../tokens/tokens.module';
import { EnqueueInventoriesProcessor } from './processors/enqueue.processor';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { DefaultJobOptions } from 'bullmq';

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
    BullModule.registerQueue({
      name: 'inventories',
      defaultJobOptions,
    }),
    BullModule.registerQueue({
      name: 'enqueueInventories',
      defaultJobOptions,
    }),
    TokensModule,
    RedisModule,
  ],
  providers: [
    InventoriesService,
    InventoriesProcessor,
    EnqueueInventoriesProcessor,
  ],
  controllers: [InventoriesController],
  exports: [InventoriesService],
})
export class InventoriesModule {}
