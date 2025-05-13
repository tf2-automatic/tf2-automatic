import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration, { Config } from './common/config/configuration';
import { validation } from './common/config/validation';
import { BotsModule } from './bots/bots.module';
import { RedisModule } from '@songkeys/nestjs-redis';
import { HealthModule } from './health/health.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { HeartbeatsModule } from './heartbeats/heartbeats.module';
import { InventoriesModule } from './inventories/inventories.module';
import { NestEventsModule } from '@tf2-automatic/nestjs-events';
import { BullModule } from '@nestjs/bullmq';
import { TradesModule } from './trades/trades.module';
import { EscrowModule } from './escrow/escrow.module';
import {
  Redis as RedisConfig,
  getEventsConfig,
  getRelayConfig,
  getUserAgent,
} from '@tf2-automatic/config';
import { BOT_EXCHANGE_NAME } from '@tf2-automatic/bot-data';
import { BOT_MANAGER_EXCHANGE_NAME } from '@tf2-automatic/bot-manager-data';
import { RelayModule } from '@tf2-automatic/nestjs-relay';
import { HttpModule } from '@nestjs/axios';
import { ClsModule } from 'nestjs-cls';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { UserAgentInterceptor } from '@tf2-automatic/nestjs';
import { PendingModule } from './pending/pending.module';

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
        const redisConfig =
          configService.getOrThrow<RedisConfig.Config>('redis');
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
        const redisConfig =
          configService.getOrThrow<RedisConfig.Config>('redis');
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
    NestEventsModule.forRoot({
      publishingExchange: BOT_MANAGER_EXCHANGE_NAME,
      subscriberExchanges: [BOT_EXCHANGE_NAME, BOT_MANAGER_EXCHANGE_NAME],
      config: getEventsConfig(),
    }),
    HealthModule,
    HeartbeatsModule,
    BotsModule,
    InventoriesModule,
    TradesModule,
    EscrowModule,
    RelayModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => {
        return {
          relay: getRelayConfig(),
          redis: RedisConfig.getConfig(),
        };
      },
    }),
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
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    PendingModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: UserAgentInterceptor,
    },
  ],
})
export class AppModule {}
