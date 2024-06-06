import { Inject, Injectable } from '@nestjs/common';
import { MetadataService } from '../metadata/metadata.service';
import { BaseEvent } from '@tf2-automatic/bot-data';
import { CustomEventsService } from './custom/custom.interface';

@Injectable()
export class EventsService {
  constructor(
    private readonly metadataService: MetadataService,
    @Inject('EVENTS_ENGINE') private readonly engine: CustomEventsService,
  ) {}

  async publish(event: string, data: object = {}): Promise<void> {
    const steamid64 = this.metadataService.getSteamID()?.getSteamID64() ?? null;

    await this.engine.publish(event, {
      type: event,
      data,
      metadata: {
        steamid64: steamid64,
        time: Math.floor(new Date().getTime() / 1000),
      },
    } as BaseEvent<unknown>);
  }
}
