import { RedisModule } from '@liaoliaots/nestjs-redis';
import { Module } from '@nestjs/common';
import { HeartbeatsModule } from '../heartbeats/heartbeats.module';
import { InventoriesController } from './inventories.controller';
import { InventoriesService } from './inventories.service';
import { BullModule } from '@nestjs/bullmq';
import { InventoriesProcessor } from './inventories.processor';
import { defaultJobOptions } from '@tf2-automatic/queue';
import { RelayModule } from '@tf2-automatic/nestjs-relay';
import { ClsModule } from 'nestjs-cls';

@Module({
  imports: [
    RedisModule,
    HeartbeatsModule,
    BullModule.registerQueue({
      name: 'inventories',
      defaultJobOptions,
    }),
    RelayModule,
    ClsModule.forFeature(),
  ],
  controllers: [InventoriesController],
  providers: [InventoriesService, InventoriesProcessor],
})
export class InventoriesModule {}
