import { Module } from '@nestjs/common';
import { ManagerService } from './manager.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [ManagerService],
  exports: [ManagerService],
})
export class ManagerModule {}
