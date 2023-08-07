import { Module } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { ListingsProcessor } from './listings.processor';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({
      name: 'listings',
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
  ],
  providers: [ListingsService, ListingsProcessor],
  controllers: [ListingsController],
})
export class ListingsModule {}
