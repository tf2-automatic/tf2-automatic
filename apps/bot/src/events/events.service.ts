import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config, RabbitMQConfig } from '../common/config/configuration';
import type { ConfirmChannel } from 'amqplib';
import { MetadataService } from '../metadata/metadata.service';

@Injectable()
export class EventsService implements OnModuleDestroy {
  private readonly prefix =
    this.configService.getOrThrow<RabbitMQConfig>('rabbitmq').prefix;

  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly amqpConnection: AmqpConnection,
    private readonly metadataService: MetadataService
  ) {}

  async onModuleDestroy(): Promise<void> {
    return (this.amqpConnection.channel as ConfirmChannel).waitForConfirms();
  }

  async publish(event: string, data: any = {}): Promise<void> {
    const steamid64 = this.metadataService.getSteamID()?.getSteamID64() ?? null;

    await this.amqpConnection.publish(`${this.prefix}.bot`, event, {
      type: event,
      data,
      metadata: {
        steamid64: steamid64,
        time: Math.floor(new Date().getTime() / 1000),
      },
    });
  }
}
