import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { BotsService } from './bots.service';

@Module({
  imports: [HttpModule],
  providers: [BotsService],
  controllers: [],
  exports: [BotsService],
})
export class BotsModule {}
