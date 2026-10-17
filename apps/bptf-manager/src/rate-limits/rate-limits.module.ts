import { Module } from '@nestjs/common';
import { RateLimitsService } from './rate-limits.service';

@Module({
  providers: [RateLimitsService],
  exports: [RateLimitsService],
})
export class RateLimitsModule {}
