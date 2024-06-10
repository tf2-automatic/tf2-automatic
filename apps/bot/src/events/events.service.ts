import { Injectable } from '@nestjs/common';
import { MetadataService } from '../metadata/metadata.service';
import { NestEventsService } from '@tf2-automatic/nestjs-events';

@Injectable()
export class EventsService {
  constructor(
    private readonly metadataService: MetadataService,
    private readonly eventsService: NestEventsService,
  ) {}

  async publish(event: string, data: object = {}): Promise<void> {
    const steamid = this.metadataService.getSteamID() ?? undefined;
    await this.eventsService.publish(event, data, steamid);
  }
}
