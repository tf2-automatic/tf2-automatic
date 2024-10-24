import { Global, Module } from '@nestjs/common';
import { NestStorageService } from './nestjs-storage.service';
import { StorageConfig } from '@tf2-automatic/config';
import { ConfigurableModuleClass } from './nestjs-storage.module-definition';

export type StorageModuleOptions = StorageConfig;

@Global()
@Module({
  providers: [NestStorageService],
  exports: [NestStorageModule, NestStorageService],
})
export class NestStorageModule extends ConfigurableModuleClass {}
