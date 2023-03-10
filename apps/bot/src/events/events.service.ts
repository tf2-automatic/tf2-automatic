import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '../common/config/configuration';
import type { ConfirmChannel } from 'amqplib';
import { MetadataService } from '../metadata/metadata.service';
import { BaseEvent, BOT_EXCHANGE_NAME } from '@tf2-automatic/bot-data';

@Injectable()
export class EventsService implements OnModuleDestroy {
  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly amqpConnection: AmqpConnection,
    private readonly metadataService: MetadataService
  ) {}

  async onModuleDestroy(): Promise<void> {
    return (this.amqpConnection.channel as ConfirmChannel).waitForConfirms();
  }

  async publish(
    event: string,
    data: { [key: string]: unknown } = {}
  ): Promise<void> {
    const steamid64 = this.metadataService.getSteamID()?.getSteamID64() ?? null;

    await this.amqpConnection.publish(BOT_EXCHANGE_NAME, event, {
      type: event,
      data,
      metadata: {
        steamid64: steamid64,
        time: Math.floor(new Date().getTime() / 1000),
      },
    } as BaseEvent<unknown>);
  }
}
