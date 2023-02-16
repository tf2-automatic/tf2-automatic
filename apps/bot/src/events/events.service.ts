import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config, RabbitMQConfig } from '../common/config/configuration';
import type { ConfirmChannel } from 'amqplib';

@Injectable()
export class EventsService implements OnModuleDestroy {
  private readonly prefix =
    this.configService.getOrThrow<RabbitMQConfig>('rabbitmq').prefix;

  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly amqpConnection: AmqpConnection
  ) {}

  async onModuleDestroy(): Promise<void> {
    return (this.amqpConnection.channel as ConfirmChannel).waitForConfirms();
  }

  async publish(event: string, data: any): Promise<void> {
    await this.amqpConnection.publish(`${this.prefix}.bot`, event, data);
  }
}
