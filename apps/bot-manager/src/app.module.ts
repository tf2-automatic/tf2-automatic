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
import { Redis as RedisConfig, getEventsConfig } from '@tf2-automatic/config';
import { BOT_EXCHANGE_NAME } from '@tf2-automatic/bot-data';
import { BOT_MANAGER_EXCHANGE_NAME } from '@tf2-automatic/bot-manager-data';

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
        const redisConfig =
          configService.getOrThrow<RedisConfig.Config>('redis');
        return {
          prefix: redisConfig.keyPrefix + 'bot-manager:bull',
          connection: {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db,
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
  ],
})
export class AppModule {}
