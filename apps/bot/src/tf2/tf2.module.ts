import { DynamicModule, Module } from '@nestjs/common';
import { BotModule } from '../bot/bot.module';
import { TF2Controller } from './tf2.controller';
import { TF2Service } from './tf2.service';
import { getEnvWithDefault } from '@tf2-automatic/config';

@Module({})
export class TF2Module {
  static register(): DynamicModule {
    const enabled = getEnvWithDefault('TF2_ENABLED', 'boolean', true);

    if (!enabled) {
      return {
        module: TF2Module,
      };
    }

    return {
      module: TF2Module,
      imports: [BotModule],
      controllers: [TF2Controller],
      providers: [TF2Service],
    };
  }
}
