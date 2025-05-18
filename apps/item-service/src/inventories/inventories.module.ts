import { Module } from '@nestjs/common';
import { InventoriesService } from './inventories.service';
import { InventoriesController } from './inventories.controller';
import { BotsModule } from '../bots/bots.module';
import { SchemaModule } from '../schema/schema.module';
import { RedisModule } from '@songkeys/nestjs-redis';
import { ManagerModule } from '../manager/manager.module';
import { RelayModule } from '@tf2-automatic/nestjs-relay';
import { defaultJobOptions } from '@tf2-automatic/queue';
import { BullModule } from '@nestjs/bullmq';
import { InventoriesProcessor } from './inventories.processor';

@Module({
  imports: [
    BotsModule,
    SchemaModule,
    RedisModule,
    ManagerModule,
    RelayModule,
    BullModule.registerQueue({
      name: 'inventories',
      defaultJobOptions,
    }),
  ],
  providers: [InventoriesService, InventoriesProcessor],
  controllers: [InventoriesController],
  exports: [InventoriesService],
})
export class InventoriesModule {}
