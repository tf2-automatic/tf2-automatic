import { RedisModule } from '@liaoliaots/nestjs-redis';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { HeartbeatsModule } from '../heartbeats/heartbeats.module';
import { RabbitMQWrapperModule } from '../rabbitmq-wrapper/rabbitmq-wrapper.module';
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
    RabbitMQWrapperModule,
    EventsModule,
    BullModule.registerQueue({
      name: 'inventories',
      defaultJobOptions,
    }),
  ],
  controllers: [InventoriesController],
  providers: [InventoriesService, InventoriesProcessor],
})
export class InventoriesModule {}
