import {
  RabbitSubscribe,
  requeueErrorHandler,
} from '@golevelup/nestjs-rabbitmq';
import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import {
  BOT_EXCHANGE_NAME,
  TradeChangedEvent,
  TradeOfferExchangeDetails,
  TRADES_BASE_URL,
  TRADE_CHANGED_EVENT,
  TRADE_EXCHANGE_DETAILS_PATH,
} from '@tf2-automatic/bot-data';
import { Queue } from 'bullmq';
import { firstValueFrom } from 'rxjs';
import SteamUser from 'steam-user';
import SteamID from 'steamid';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';
import { ExchangeDetailsQueueData } from './interfaces/exchange-details-queue.interface';

@Injectable()
export class TradesService {
  constructor(
    private readonly heartbeatsService: HeartbeatsService,
    private readonly httpService: HttpService,
    @InjectQueue('getExchangeDetails')
    private readonly exchangeDetailsQueue: Queue<ExchangeDetailsQueueData>
  ) {}

  @RabbitSubscribe({
    allowNonJsonMessages: false,
    exchange: BOT_EXCHANGE_NAME,
    queue: 'bot-manager.exchange-details',
    routingKey: TRADE_CHANGED_EVENT,
    errorHandler: requeueErrorHandler,
  })
  public async handleTradeChanged(event: TradeChangedEvent) {
    if (event.data.offer.state !== SteamUser.ETradeOfferState.Accepted) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const steamid = new SteamID(event.metadata.steamid64!);

    await this.exchangeDetailsQueue.add(
      event.data.offer.id,
      {
        offer: event.data.offer,
        steamid64: steamid.getSteamID64(),
      },
      {
        jobId: `offer:${event.data.offer.id}`,
      }
    );
  }

  async getExchangeDetails(
    steamid: SteamID,
    offerId: string
  ): Promise<TradeOfferExchangeDetails> {
    const bot = await this.heartbeatsService.getBot(steamid);

    const url =
      `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADE_EXCHANGE_DETAILS_PATH}`.replace(
        ':id',
        offerId
      );

    return firstValueFrom(this.httpService.get(url)).then((res) => res.data);
  }
}
