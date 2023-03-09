import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BOT_EXCHANGE_NAME } from '@tf2-automatic/bot-data';
import { Config, RabbitMQConfig } from '../common/config/configuration';
import { MetadataModule } from '../metadata/metadata.module';
import { EventsService } from './events.service';

@Module({
  imports: [
    RabbitMQModule.forRootAsync(RabbitMQModule, {
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Config>) => {
        const rabbitmqConfig =
          configService.getOrThrow<RabbitMQConfig>('rabbitmq');

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
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
