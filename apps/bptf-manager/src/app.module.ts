import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration, { Config } from './common/config/configuration';
import { validation } from './common/config/validation';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { ListingsModule } from './listings/listings.module';
import { InventoriesModule } from './inventories/inventories.module';
import { TokensModule } from './tokens/tokens.module';
import { BullModule } from '@nestjs/bullmq';
import { AgentsModule } from './agents/agents.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationsModule } from './notifications/notifications.module';
import { getUserAgent, Redis } from '@tf2-automatic/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      ignoreEnvFile: true,
      load: [configuration],
      validationSchema: validation,
    }),
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Config>) => {
        const redisConfig = configService.getOrThrow<Redis.Config>('redis');
        return {
          readyLog: true,
          config: {
            ...redisConfig,
            keyPrefix: redisConfig.keyPrefix + 'data:',
          },
        };
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Config>) => {
        const redisConfig = configService.getOrThrow<Redis.Config>('redis');
        return {
          prefix: redisConfig.keyPrefix + 'bull',
          connection: {
            ...redisConfig,
            keyPrefix: undefined,
          },
        };
      },
    }),
    PrometheusModule.register(),
    EventEmitterModule.forRoot(),
    ListingsModule,
    InventoriesModule,
    TokensModule,
    AgentsModule,
    NotificationsModule,
    HttpModule.registerAsync({
      global: true,
      useFactory: () => {
        const headers: Record<string, string> = {};

        const agent = getUserAgent();
        if (agent) {
          headers['User-Agent'] = agent;
        }

        return {
          headers,
        };
      },
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
