import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { DynamicModule, Global, Logger, Module } from '@nestjs/common';
import { EventsConfig, RabbitMQ } from '@tf2-automatic/config';
import { NestEventsService } from './nestjs-events.service';
import { RabbitMQEventsService } from './custom/rabbitmq.service';
import { RedisEventsService } from './custom/redis.service';

export interface EventsModuleOptions<T extends EventsConfig = EventsConfig> {
  publishingExchange: string;
  subscriberExchanges: string[];
  config: T;
}

// TODO: Use forRootAsync which allows for config to be based on config service
// TODO: Do not make the module global

@Global()
@Module({})
export class NestEventsModule {
  static forRoot(options: EventsModuleOptions): DynamicModule {
    let dynamicModule: DynamicModule;

    if (options.config.type === 'rabbitmq') {
      dynamicModule = rabbitmq(options);
    } else if (options.config.type === 'redis') {
      dynamicModule = redis(options);
    } else {
      throw new Error('Invalid EVENTS_TYPE value');
    }

    dynamicModule.providers = dynamicModule.providers ?? [];

    dynamicModule.providers.push({
      provide: 'EVENTS_OPTIONS',
      useValue: options,
    });

    Logger.log(
      'Using events type "' + options.config.type + '"',
      NestEventsModule.name,
    );

    return dynamicModule;
  }
}

function rabbitmq(options: EventsModuleOptions): DynamicModule {
  const config = options.config as RabbitMQ.Config;

  return {
    module: NestEventsModule,
    imports: [
      RabbitMQModule.forRootAsync(RabbitMQModule, {
        useFactory: () => {
          const exchanges = options.subscriberExchanges.map((exchange) => ({
            name: exchange,
            type: 'topic',
          }));

          exchanges.push({
            name: options.publishingExchange,
            type: 'topic',
          });

          return {
            exchanges,
            uri: `amqp://${config.username}:${config.password}@${config.host}:${config.port}/${config.vhost}`,
          };
        },
      }),
    ],
    providers: [
      NestEventsService,
      {
        provide: 'EVENTS_ENGINE',
        useClass: RabbitMQEventsService,
      },
    ],
    exports: [NestEventsService],
  };
}

function redis(options: EventsModuleOptions): DynamicModule {
  return {
    module: NestEventsModule,
    providers: [
      NestEventsService,
      {
        provide: 'EVENTS_ENGINE',
        useClass: RedisEventsService,
      },
    ],
    exports: [NestEventsService],
  };
}
