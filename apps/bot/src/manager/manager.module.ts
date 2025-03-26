import { Module } from '@nestjs/common';
import { MetadataModule } from '../metadata/metadata.module';
import { ManagerService } from './manager.service';

@Module({
  imports: [MetadataModule],
  providers: [ManagerService],
})
export class ManagerModule {}
