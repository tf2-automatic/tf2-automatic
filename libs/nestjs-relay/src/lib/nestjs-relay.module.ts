import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { RelayService } from './nestjs-relay.service';
import { RelayModuleConfig } from '@tf2-automatic/config';
import { NestEventsModule } from '@tf2-automatic/nestjs-events';
import { ClsModule } from 'nestjs-cls';


@Global()
@Module({})
export class RelayModule {
  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<RelayModuleConfig> | RelayModuleConfig;
    inject?: any[];
  }): DynamicModule {
    return this.createDynamicModule({
      provide: 'RELAY_CONFIG',
      useFactory: options.useFactory,
      inject: options.inject,
    });
  }

  static forRoot(config: RelayModuleConfig): DynamicModule {
    return this.createDynamicModule({
      provide: 'RELAY_CONFIG',
      useValue: config,
    });
  }

  private static createDynamicModule(provider: Provider): DynamicModule {
    return {
      module: RelayModule,
      imports: [NestEventsModule, ClsModule.forFeature()],
      providers: [provider, RelayService],
      exports: [RelayService],
    };
  }
}
