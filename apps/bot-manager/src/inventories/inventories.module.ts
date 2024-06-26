import { RedisModule } from '@songkeys/nestjs-redis';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { HeartbeatsModule } from '../heartbeats/heartbeats.module';
import { InventoriesController } from './inventories.controller';
import { InventoriesService } from './inventories.service';
import { BullModule } from '@nestjs/bullmq';
import { InventoriesProcessor } from './inventories.processor';
import { defaultJobOptions } from '../common/utils/default-job-options';

@Module({
  imports: [
    RedisModule,
    HttpModule,
    HeartbeatsModule,
    BullModule.registerQueue({
      name: 'inventories',
      defaultJobOptions,
    }),
  ],
  controllers: [InventoriesController],
  providers: [InventoriesService, InventoriesProcessor],
})
export class InventoriesModule {}
