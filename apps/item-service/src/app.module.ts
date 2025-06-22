import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration, { Config } from './common/config/configuration';
import { validation } from './common/config/validation';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  getEventsConfig,
  getRelayConfig,
  getStorageConfig,
  getUserAgent,
  Redis,
} from '@tf2-automatic/config';
import { NestEventsModule } from '@tf2-automatic/nestjs-events';
import { BOT_EXCHANGE_NAME } from '@tf2-automatic/bot-data';
import { BOT_MANAGER_EXCHANGE_NAME } from '@tf2-automatic/bot-manager-data';
import { ITEM_SERVICE_EXCHANGE_NAME } from '@tf2-automatic/item-service-data';
import { SchemaModule } from './schema/schema.module';
import { BotsModule } from './bots/bots.module';
import { HealthModule } from './health/health.module';
import { NestStorageModule } from '@tf2-automatic/nestjs-storage';
import { InventoriesModule } from './inventories/inventories.module';
import { ManagerModule } from './manager/manager.module';
import { RelayModule } from '@tf2-automatic/nestjs-relay';
import { Redis as RedisConfig } from '@tf2-automatic/config';
import { HttpModule } from '@nestjs/axios';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { UserAgentInterceptor } from '@tf2-automatic/nestjs';
import { ClsModule } from 'nestjs-cls';
import { PricesModule } from './prices/prices.module';

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
    NestEventsModule.forRoot({
      publishingExchange: ITEM_SERVICE_EXCHANGE_NAME,
      subscriberExchanges: [
        BOT_EXCHANGE_NAME,
        BOT_MANAGER_EXCHANGE_NAME,
        ITEM_SERVICE_EXCHANGE_NAME,
      ],
      config: getEventsConfig(),
    }),
    NestStorageModule.registerAsync({
      inject: [ConfigService],
      useFactory: () => {
        return getStorageConfig();
      },
    }),
    PrometheusModule.register(),
    EventEmitterModule.forRoot(),
    HealthModule,
    BotsModule,
    SchemaModule,
    InventoriesModule,
    ManagerModule,
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
    PricesModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: UserAgentInterceptor,
    },
  ],
})
export class AppModule {}
