import { DynamicModule, Module } from '@nestjs/common';
import { RelayService } from './relay.service';
import { getEventsConfig } from '@tf2-automatic/config';

@Module({})
export class RelayModule {
  static forRoot(): DynamicModule {
    const dynamicModule: DynamicModule = {
      module: RelayModule,
    };

    const eventsConfig = getEventsConfig();

    if (eventsConfig.type === 'rabbitmq') {
      dynamicModule.providers = [RelayService];
    }

    return dynamicModule;
  }
}
