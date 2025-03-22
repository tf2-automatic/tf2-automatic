import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { BotsService } from './bots.service';
import { ManagerModule } from '../manager/manager.module';

@Module({
  imports: [HttpModule, ManagerModule],
  providers: [BotsService],
  controllers: [],
  exports: [BotsService],
})
export class BotsModule {}
