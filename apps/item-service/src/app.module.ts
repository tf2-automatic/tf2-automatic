import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration, { Config } from './common/config/configuration';
import { validation } from './common/config/validation';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { RedisModule } from '@songkeys/nestjs-redis';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  getEventsConfig,
  getStorageConfig,
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
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db,
            keyPrefix: redisConfig.keyPrefix,
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
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db,
          },
        };
      },
    }),
    NestEventsModule.forRoot({
      publishingExchange: ITEM_SERVICE_EXCHANGE_NAME,
      subscriberExchanges: [BOT_EXCHANGE_NAME, BOT_MANAGER_EXCHANGE_NAME],
      config: getEventsConfig(),
    }),
    NestStorageModule.register(getStorageConfig()),
    PrometheusModule.register(),
    EventEmitterModule.forRoot(),
    HealthModule,
    BotsModule,
    SchemaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
