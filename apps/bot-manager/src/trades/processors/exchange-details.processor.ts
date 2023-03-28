import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  ExchangeDetailsEvent,
  EXCHANGE_DETAILS_EVENT,
} from '@tf2-automatic/bot-manager-data';
import { Job } from 'bullmq';
import SteamID from 'steamid';
import { EventsService } from '../../events/events.service';
import { ExchangeDetailsQueueData } from '../interfaces/exchange-details-queue.interface';
import { TradesService } from '../trades.service';

@Processor('getExchangeDetails')
export class ExchangeDetailsProcessor extends WorkerHost {
  private readonly logger = new Logger(ExchangeDetailsProcessor.name);

  constructor(
    private readonly tradesService: TradesService,
    private readonly eventsService: EventsService
  ) {
    super();
  }

  async process(job: Job<ExchangeDetailsQueueData>): Promise<void> {
    const offer = job.data.offer;
    const bot = new SteamID(job.data.bot);

    this.logger.debug('Getting exchange details for offer ' + offer.id + '...');

    const details = await this.tradesService.getExchangeDetails(bot, offer.id);

    this.logger.debug(
      'Publishing exchange details for offer ' + offer.id + '...'
    );

    await this.eventsService.publish(
      EXCHANGE_DETAILS_EVENT,
      {
        offer: job.data.offer,
        details,
      } satisfies ExchangeDetailsEvent['data'],
      bot
    );
  }
}
