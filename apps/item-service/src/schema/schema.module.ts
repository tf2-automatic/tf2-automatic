import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { defaultJobOptions } from '@tf2-automatic/queue';
import { SchemaService } from './schema.service';
import { SchemaProcessor } from './schema.processor';
import { BotsModule } from '../bots/bots.module';
import { SchemaController } from './schema.controller';
import { HealthModule } from '../health/health.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'schema',
      defaultJobOptions,
    }),
    BotsModule,
    HealthModule,
  ],
  providers: [SchemaService, SchemaProcessor],
  controllers: [SchemaController],
})
export class SchemaModule {}
