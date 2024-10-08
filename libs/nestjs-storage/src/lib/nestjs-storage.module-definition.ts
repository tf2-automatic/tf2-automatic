import { ConfigurableModuleBuilder } from '@nestjs/common';
import { StorageModuleOptions } from './nestjs-storage.module';

const builder = new ConfigurableModuleBuilder<StorageModuleOptions>();

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  builder.build();
