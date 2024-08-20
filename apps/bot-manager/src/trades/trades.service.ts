import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
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
  TRADE_REFRESH_PATH,
  TradeOffer,
  TRADE_CONFIRMED_PATH,
  CheckConfirmationResponse,
  CheckAcceptedResponse,
  TRADE_ACCEPTED_PATH,
  CheckDeletedResponse,
  TRADE_DELETED_PATH,
} from '@tf2-automatic/bot-data';
import {
  Bot,
  QueueTradeResponse,
  Job,
  QueueTradeJob,
} from '@tf2-automatic/bot-manager-data';
import {
  CreateTradeDto,
  GetExchangeDetailsDto,
  GetTradesDto,
} from '@tf2-automatic/dto';
import { Job as BullJob, Queue } from 'bullmq';
import { firstValueFrom } from 'rxjs';
import SteamID from 'steamid';
import { ExchangeDetailsQueueData } from './interfaces/exchange-details-queue.interface';
import { v4 as uuidv4 } from 'uuid';
import { TradeQueue } from './interfaces/trade-queue.interface';
import { Redis } from 'ioredis';
import { InjectRedis } from '@songkeys/nestjs-redis';
import Redlock from 'redlock';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import { getLockConfig } from '@tf2-automatic/config';

@Injectable()
export class TradesService implements OnApplicationBootstrap {
  private readonly redlock: Redlock;

  constructor(
    private readonly httpService: HttpService,
    @InjectQueue('getExchangeDetails')
    private readonly exchangeDetailsQueue: Queue<ExchangeDetailsQueueData>,
    @InjectQueue('trades')
    private readonly tradesQueue: Queue<TradeQueue>,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventsService: NestEventsService,
  ) {
    this.redlock = new Redlock([this.redis], getLockConfig());
  }

  async onApplicationBootstrap() {
    await this.eventsService.subscribe(
      'bot-manager.exchange-details',
      BOT_EXCHANGE_NAME,
      [TRADE_CHANGED_EVENT],
      (event) => this.handleTradeChanged(event as any),
      {
        retry: true,
      },
    );
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

    let offerId: string | null;

    switch (dto.type) {
      case 'CREATE':
        // Don't use the id from the dto, as it's not unique.
        offerId = null;
        break;
      case 'ACCEPT':
      case 'CONFIRM':
      case 'DELETE':
      case 'REFRESH':
        offerId = dto.data;
        break;
      case 'COUNTER':
        offerId = dto.data.id;
        break;
      default:
        // @ts-expect-error Gives compile-time error if all cases are not handled.
        throw new Error('Unknown task type: ' + dto.type);
    }

    if (offerId == null) {
      return createJob(uuidv4());
    }

    const jobId = 'trades:' + offerId;

    return this.redlock.using([jobId], 1000, async (signal) => {
      const exists = await this.tradesQueue.getJob(jobId);
      if (exists) {
        throw new ConflictException('A job already exists for the offer');
      }

      if (signal.aborted) {
        throw signal.error;
      }

      return createJob(jobId);
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
        tradeId,
      );

    await firstValueFrom(this.httpService.delete(url));
  }

  async deletedTrade(bot: Bot, tradeId: string): Promise<CheckDeletedResponse> {
    const url =
      `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADE_DELETED_PATH}`.replace(
        ':id',
        tradeId,
      );

    const response = await firstValueFrom(
      this.httpService.get<CheckDeletedResponse>(url),
    );

    return response.data;
  }

  async acceptTrade(bot: Bot, tradeId: string): Promise<void> {
    const url =
      `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADE_ACCEPT_PATH}`.replace(
        ':id',
        tradeId,
      );

    await firstValueFrom(this.httpService.post(url));
  }

  async acceptedTrade(
    bot: Bot,
    tradeId: string,
  ): Promise<CheckAcceptedResponse> {
    const url =
      `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADE_ACCEPTED_PATH}`.replace(
        ':id',
        tradeId,
      );

    const response = await firstValueFrom(
      this.httpService.get<CheckAcceptedResponse>(url),
    );

    return response.data;
  }

  async confirmTrade(bot: Bot, tradeId: string): Promise<void> {
    const url =
      `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADE_CONFIRMATION_PATH}`.replace(
        ':id',
        tradeId,
      );

    await firstValueFrom(this.httpService.post(url));
  }

  async confirmedTrade(
    bot: Bot,
    tradeId: string,
  ): Promise<CheckConfirmationResponse> {
    const url =
      `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADE_CONFIRMED_PATH}`.replace(
        ':id',
        tradeId,
      );

    const response = await firstValueFrom(
      this.httpService.get<CheckConfirmationResponse>(url),
    );

    return response.data;
  }

  async refreshTrade(bot: Bot, tradeId: string): Promise<TradeOffer> {
    const url =
      `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADE_REFRESH_PATH}`.replace(
        ':id',
        tradeId,
      );

    const response = await firstValueFrom(
      this.httpService.post<GetTradeResponse>(url),
    );

    return response.data;
  }

  async createTrade(
    bot: Bot,
    trade: CreateTrade,
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
      this.httpService.post<CreateTradeResponse>(url, data),
    ).then((res) => {
      return res.data;
    });
  }

  counterTrade(
    bot: Bot,
    id: string,
    data: CounterTrade,
  ): Promise<CreateTradeResponse> {
    const url =
      `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADE_COUNTER_PATH}`.replace(
        ':id',
        id,
      );

    return firstValueFrom(this.httpService.post(url, data)).then((res) => {
      return res.data;
    });
  }

  getTrade(bot: Bot, tradeId: string): Promise<GetTradeResponse> {
    const url =
      `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADE_PATH}`.replace(
        ':id',
        tradeId,
      );

    return firstValueFrom(this.httpService.get<GetTradeResponse>(url)).then(
      (res) => res.data,
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
      }),
    ).then((res) => res.data);
  }

  private async handleTradeChanged(event: TradeChangedEvent) {
    if (event.data.offer.tradeID === null) {
      // Trade has not been accepted
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const steamid = new SteamID(event.metadata.steamid64!);

    await this.exchangeDetailsQueue.add(
      event.data.offer.id,
      {
        offer: event.data.offer,
        bot: steamid.getSteamID64(),
        retry: {
          maxDelay: 60000,
        },
      },
      {
        jobId: `offer:${event.data.offer.id}`,
      },
    );
  }

  async getExchangeDetails(
    bot: Bot,
    offerId: string,
    getDetailsIfFailed = false,
  ): Promise<TradeOfferExchangeDetails> {
    const url =
      `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADE_EXCHANGE_DETAILS_PATH}`.replace(
        ':id',
        offerId,
      );

    const params: GetExchangeDetailsDto = {
      getDetailsIfFailed,
    };

    return firstValueFrom(
      this.httpService.get<TradeOfferExchangeDetails>(url, {
        params,
      }),
    ).then((res) => res.data);
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
