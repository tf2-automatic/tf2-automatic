import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MetadataModule } from '../metadata/metadata.module';
import { ManagerService } from './manager.service';

@Module({
  imports: [HttpModule, MetadataModule],
  providers: [ManagerService],
})
export class ManagerModule {}
