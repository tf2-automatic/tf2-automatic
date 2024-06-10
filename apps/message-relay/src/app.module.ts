import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration, { Config } from './common/config/configuration';
import { validation } from './common/config/validation';
import { RedisModule } from '@songkeys/nestjs-redis';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { PublisherModule } from './publisher/publisher.module';
import { OUTBOX_KEY } from '@tf2-automatic/transactional-outbox';
import { Redis, RabbitMQ } from '@tf2-automatic/config';
import { NestEventsModule } from '@tf2-automatic/nestjs-events';
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
        const redisConfig = configService.getOrThrow<Redis.Config>('redis');
        return {
          readyLog: true,
          config: [
            // Leader election
            {
              host: redisConfig.host,
              port: redisConfig.port,
              password: redisConfig.password,
              db: redisConfig.db,
              keyPrefix: redisConfig.keyPrefix + 'message-relay:',
            },
            // Subscribe to outbox channel
            {
              namespace: 'subscribe',
              host: redisConfig.host,
              port: redisConfig.port,
              password: redisConfig.password,
              db: redisConfig.db,
            },
            // Outbox
            {
              namespace: OUTBOX_KEY,
              host: redisConfig.host,
              port: redisConfig.port,
              password: redisConfig.password,
              db: redisConfig.db,
              keyPrefix: redisConfig.keyPrefix,
            },
          ],
        };
      },
    }),
    PrometheusModule.register(),
    NestEventsModule.forRoot({
      config: {
        ...RabbitMQ.getConfig(),
        persist: true,
      },
      publishingExchange: BOT_MANAGER_EXCHANGE_NAME,
      subscriberExchanges: [],
    }),
    PublisherModule,
  ],
})
export class AppModule {}
