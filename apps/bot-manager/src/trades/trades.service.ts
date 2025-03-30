import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Injectable,
  Logger,
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
  TRADE_CONFIRMED_PATH,
  CheckConfirmationResponse,
  CheckAcceptedResponse,
  TRADE_ACCEPTED_PATH,
  CheckDeletedResponse,
  TRADE_DELETED_PATH,
  TradeOfferWithItems,
} from '@tf2-automatic/bot-data';
import {
  Bot,
  QueueTradeResponse,
  Job,
  QueueTradeJob,
  EXCHANGE_DETAILS_EVENT,
  ExchangeDetailsEvent,
} from '@tf2-automatic/bot-manager-data';
import {
  CreateTradeDto,
  GetExchangeDetailsDto,
  GetTradesDto,
} from '@tf2-automatic/dto';
import { Job as BullJob, Queue } from 'bullmq';
import { firstValueFrom } from 'rxjs';
import SteamID from 'steamid';
import { v4 as uuidv4 } from 'uuid';
import { TradeQueue } from './trades.types';
import { Redis } from 'ioredis';
import { InjectRedis } from '@songkeys/nestjs-redis';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import { LockDuration, Locker } from '@tf2-automatic/locking';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';
import { ClsService } from 'nestjs-cls';
import { CustomJob, QueueManagerWithEvents } from '@tf2-automatic/queue';

@Injectable()
export class TradesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TradesService.name);

  private readonly queueManager: QueueManagerWithEvents<
    TradeQueue['options'],
    TradeQueue
  >;

  private readonly locker: Locker;

  constructor(
    private readonly httpService: HttpService,
    @InjectQueue('trades')
    queue: Queue<CustomJob<TradeQueue>>,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventsService: NestEventsService,
    private readonly heartbeatService: HeartbeatsService,
    cls: ClsService,
  ) {
    this.locker = new Locker(this.redis);

    this.queueManager = new QueueManagerWithEvents(queue, cls);
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

  async addJob(dto: QueueTradeJob): Promise<QueueTradeResponse> {
    const createJob = async (id: string) => {
      const job = await this.queueManager.addJob(id, dto.type, dto.data, {
        bot: dto.bot,
        retry: dto.retry,
        priority: dto.priority,
      });

      return {
        id: job.id!,
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

    return this.locker.using([jobId], LockDuration.SHORT, async (signal) => {
      const exists = await this.queueManager.getJobById(jobId);
      if (exists) {
        throw new ConflictException('A job already exists for the offer');
      }

      if (signal.aborted) {
        throw signal.error;
      }

      return createJob(jobId);
    });
  }

  removeJob(id: string): Promise<boolean> {
    return this.queueManager.removeJobById(id);
  }

  getJobs(page = 1, pageSize = 10) {
    return this.queueManager.getJobs(page, pageSize);
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

  async refreshTrade(bot: Bot, tradeId: string): Promise<TradeOfferWithItems> {
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
    idempotencyKey?: string,
  ): Promise<CreateTradeResponse> {
    const url = `http://${bot.ip}:${bot.port}${TRADES_BASE_URL}${TRADES_PATH}`;

    const data: CreateTradeDto = {
      partner: trade.partner,
      message: trade.message,
      itemsToGive: trade.itemsToGive,
      itemsToReceive: trade.itemsToReceive,
      token: trade.token,
    };

    const headers = {};
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    return firstValueFrom(
      this.httpService.post<CreateTradeResponse>(url, data, { headers }),
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

    this.logger.debug(
      'Getting exchange details for offer ' + event.data.offer.id + '...',
    );

    const bot = await this.heartbeatService.getBot(steamid);

    const details = await this.getExchangeDetails(
      bot,
      event.data.offer.id,
      true,
    );

    this.logger.debug(
      'Publishing exchange details for offer ' + event.data.offer.id + '...',
    );

    await this.eventsService.publish(
      EXCHANGE_DETAILS_EVENT,
      {
        offer: event.data.offer,
        details,
      } satisfies ExchangeDetailsEvent['data'],
      steamid,
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
      priority: job.priority,
      data: job.data.options,
      bot: job.data.bot!,
      attempts: job.attemptsMade,
      lastProcessedAt:
        job.processedOn === undefined
          ? null
          : Math.floor(job.processedOn / 1000),
      createdAt: Math.floor(job.timestamp / 1000),
    };
  }
}
