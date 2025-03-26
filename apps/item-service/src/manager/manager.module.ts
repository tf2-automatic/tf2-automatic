import { Module } from '@nestjs/common';
import { ManagerService } from './manager.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  providers: [ManagerService],
  exports: [ManagerService],
})
export class ManagerModule {}
