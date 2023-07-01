import {
  RabbitSubscribe,
  requeueErrorHandler,
} from '@golevelup/nestjs-rabbitmq';
import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Injectable } from '@nestjs/common';
import {
  BOT_EXCHANGE_NAME,
  CreateTrade,
  CreateTradeResponse,
  GetTradesResponse,
  OfferFilter,
  TradeChangedEvent,
  TradeOfferExchangeDetails,
  TRADES_BASE_URL,
  TRADES_PATH,
  TRADE_ACCEPT_PATH,
  TRADE_CHANGED_EVENT,
  TRADE_CONFIRMATION_PATH,
  TRADE_EXCHANGE_DETAILS_PATH,
  TRADE_PATH,
  GetTradeResponse,
  TRADE_COUNTER_PATH,
  CounterTrade,
} from '@tf2-automatic/bot-data';
import {
  Bot,
  QueueTradeResponse,
  Job,
  QueueTradeJob,
} from '@tf2-automatic/bot-manager-data';
import { CreateTradeDto, GetTradesDto } from '@tf2-automatic/dto';
import { Job as BullJob, Queue } from 'bullmq';
import { firstValueFrom } from 'rxjs';
import SteamUser from 'steam-user';
import SteamID from 'steamid';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';
import { ExchangeDetailsQueueData } from './interfaces/exchange-details-queue.interface';
import { v4 as uuidv4 } from 'uuid';
import { TradeQueue } from './interfaces/trade-queue.interface';
import { Redis } from 'ioredis';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redlock from 'redlock';

@Injectable()
export class TradesService {
  private readonly redlock: Redlock;

  constructor(
    private readonly heartbeatsService: HeartbeatsService,
    private readonly httpService: HttpService,
    @InjectQueue('getExchangeDetails')
    private readonly exchangeDetailsQueue: Queue<ExchangeDetailsQueueData>,
    @InjectQueue('trades')
    private readonly tradesQueue: Queue<TradeQueue>,
    @InjectRedis() private readonly redis: Redis
  ) {
    this.redlock = new Redlock([this.redis]);
  }

  async enqueueJob(dto: QueueTradeJob): Promise<QueueTradeResponse> {
    const createJob = async (id: string) => {
      const data: TradeQueue = {
        type: dto.type,
        raw: dto.data as never,
        extra: {},
        bot: dto.bot,
        retry: dto.retry,
      };

      const job = await this.tradesQueue.add(id, data, {
        jobId: id,
        priority: dto.priority,
      });

      const jobId = job.id as string;

      return {
        id: jobId,
      };
    };

    if (dto.type === 'CREATE') {
      // Not dealing with a specific offer so we need to generate an idb
      return createJob(uuidv4());
    }

    // Get the id of the offer
    const id = dto.type === 'COUNTER' ? dto.data.id : dto.data;

    return this.redlock.using([`trades:${id}`], 1000, async (signal) => {
      const exists = await this.tradesQueue.getJob(id);
      if (exists) {
        throw new ConflictException('A job already exists for the offer');
      }

      if (signal.aborted) {
        throw signal.error;
      }

      return createJob(id);
    });
  }

  dequeueJob(id: string): Promise<boolean> {
    return this.tradesQueue.remove(id).then((res) => {
      return res === 1;
    });
  }

  getQueue(): Promise<Job[]> {
    return this.tradesQueue.getJobs().then((jobs) => {
      return jobs.map(this.mapJob);
    });
  }

  async deleteTrade(bot: Bot, tradeId: string): Promise<void> {
    const url =
      `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADE_PATH}`.replace(
        ':id',
        tradeId
      );

    await firstValueFrom(this.httpService.delete(url));
  }

  async acceptTrade(bot: Bot, tradeId: string): Promise<void> {
    const url =
      `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADE_ACCEPT_PATH}`.replace(
        ':id',
        tradeId
      );

    await firstValueFrom(this.httpService.post(url));
  }

  async confirmTrade(bot: Bot, tradeId: string): Promise<void> {
    const url =
      `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADE_CONFIRMATION_PATH}`.replace(
        ':id',
        tradeId
      );

    await firstValueFrom(this.httpService.post(url));
  }

  async createTrade(
    bot: Bot,
    trade: CreateTrade
  ): Promise<CreateTradeResponse> {
    const url = `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADES_PATH}`;

    const data: CreateTradeDto = {
      partner: trade.partner,
      message: trade.message,
      itemsToGive: trade.itemsToGive,
      itemsToReceive: trade.itemsToReceive,
      token: trade.token,
    };

    return firstValueFrom(
      this.httpService.post<CreateTradeResponse>(url, data)
    ).then((res) => {
      return res.data;
    });
  }

  counterTrade(
    bot: Bot,
    id: string,
    data: CounterTrade
  ): Promise<CreateTradeResponse> {
    const url =
      `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADE_COUNTER_PATH}`.replace(
        ':id',
        id
      );

    return firstValueFrom(this.httpService.post(url, data)).then((res) => {
      return res.data;
    });
  }

  getTrade(bot: Bot, tradeId: string): Promise<GetTradeResponse> {
    const url =
      `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADE_PATH}`.replace(
        ':id',
        tradeId
      );

    return firstValueFrom(this.httpService.get<GetTradeResponse>(url)).then(
      (res) => res.data
    );
  }

  getActiveTrades(bot: Bot): Promise<GetTradesResponse> {
    const url = `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADES_PATH}`;

    const params: GetTradesDto = {
      filter: OfferFilter.ActiveOnly,
    };

    return firstValueFrom(
      this.httpService.get<GetTradesResponse>(url, {
        params,
      })
    ).then((res) => res.data);
  }

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
        bot: steamid.getSteamID64(),
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

  mapJob(job: BullJob<TradeQueue>): Job {
    return {
      id: job.id as string,
      type: job.data.type,
      data: job.data.raw,
      bot: job.data.bot,
      attempts: job.attemptsMade,
      lastProcessedAt:
        job.processedOn === undefined
          ? null
          : Math.floor(job.processedOn / 1000),
      createdAt: Math.floor(job.timestamp / 1000),
    };
  }
}
