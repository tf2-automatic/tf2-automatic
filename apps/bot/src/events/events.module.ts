import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BOT_EXCHANGE_NAME } from '@tf2-automatic/bot-data';
import {
  Config,
  RabbitMQEventsConfig,
  RedisEventsConfig,
} from '../common/config/configuration';
import { MetadataModule } from '../metadata/metadata.module';
import { EventsService } from './events.service';
import { RabbitMQEventsService } from './custom/rabbitmq-events.service';
import { RedisEventsService } from './custom/redis-events.service';
import { RedisModule } from '@songkeys/nestjs-redis';

@Global()
@Module({})
export class EventsModule {
  static forRoot(): DynamicModule {
    if (process.env.EVENTS_TYPE === 'rabbitmq') {
      return rabbitmq();
    } else if (process.env.EVENTS_TYPE === 'redis') {
      return redis();
    }

    throw new Error('Invalid EVENTS_TYPE value');
  }
}

function rabbitmq(): DynamicModule {
  return {
    module: EventsModule,
    imports: [
      RabbitMQModule.forRootAsync(RabbitMQModule, {
        inject: [ConfigService],
        useFactory: (configService: ConfigService<Config>) => {
          const rabbitmqConfig =
            configService.getOrThrow<RabbitMQEventsConfig>('events');

          return {
            exchanges: [
              {
                name: BOT_EXCHANGE_NAME,
                type: 'topic',
              },
            ],
            uri: `amqp://${rabbitmqConfig.username}:${rabbitmqConfig.password}@${rabbitmqConfig.host}:${rabbitmqConfig.port}/${rabbitmqConfig.vhost}`,
          };
        },
      }),
      MetadataModule,
    ],
    providers: [
      EventsService,
      {
        provide: 'EVENTS_ENGINE',
        useClass: RabbitMQEventsService,
      },
    ],
    exports: [EventsService],
  };
}

function redis(): DynamicModule {
  return {
    module: EventsModule,
    imports: [
      RedisModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (configService: ConfigService<Config>) => {
          const redisConfig =
            configService.getOrThrow<RedisEventsConfig>('events');

          const config = {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
          };

          if (redisConfig.db !== undefined) {
            config['db'] = redisConfig.db;
          }

          if (redisConfig.keyPrefix !== undefined) {
            config['keyPrefix'] = redisConfig.keyPrefix + ':';
          }

          console.log(config);

          return {
            readyLog: true,
            config,
          };
        },
      }),
      MetadataModule,
    ],
    providers: [
      EventsService,
      {
        provide: 'EVENTS_ENGINE',
        useClass: RedisEventsService,
      },
    ],
    exports: [EventsService],
  };
}
