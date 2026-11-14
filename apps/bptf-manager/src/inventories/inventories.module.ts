import { Module } from '@nestjs/common';
import { InventoriesService } from './inventories.service';
import { InventoriesController } from './inventories.controller';
import { BullModule } from '@nestjs/bullmq';
import { InventoriesProcessor } from './processors/inventories.processor';
import { TokensModule } from '../tokens/tokens.module';
import { EnqueueInventoriesProcessor } from './processors/enqueue.processor';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { defaultJobOptions } from '@tf2-automatic/queue';

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
