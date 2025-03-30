import { InjectRedis } from '@songkeys/nestjs-redis';
import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  ESCROW_BASE_URL,
  ESCROW_GET_DURATION,
  GetEscrowResponse,
} from '@tf2-automatic/bot-data';
import { Bot, EscrowResponse } from '@tf2-automatic/bot-manager-data';
import { Redis } from 'ioredis';
import { firstValueFrom } from 'rxjs';
import SteamID from 'steamid';
import { GetEscrowDto } from '@tf2-automatic/dto';
import { InjectQueue } from '@nestjs/bullmq';
import {
  CustomJob,
  EnqueueOptions,
  QueueManagerWithEvents,
} from '@tf2-automatic/queue';
import { Queue } from 'bullmq';
import { EscrowData, EscrowJobData, EscrowResult } from './escrow.types';
import { ClsService } from 'nestjs-cls';
import assert from 'assert';
import { pack, unpack } from 'msgpackr';

const ESCROW_EXPIRE_TIME = 2 * 60;
const ESCROW_EXPIRE_TIME_LONG = 60 * 60;

assert(
  ESCROW_EXPIRE_TIME_LONG > ESCROW_EXPIRE_TIME,
  'ESCROW_EXPIRE_TIME_LONG must be greater than ESCROW_EXPIRE_TIME',
);

@Injectable()
export class EscrowService implements OnModuleDestroy {
  private readonly queueManager: QueueManagerWithEvents<
    EscrowJobData['options'],
    EscrowJobData
  >;

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
    private readonly httpService: HttpService,
    @InjectQueue('escrow')
    queue: Queue<CustomJob<EscrowJobData>>,
    cls: ClsService,
  ) {
    this.queueManager = new QueueManagerWithEvents(queue, cls);
  }

  onModuleDestroy() {
    return this.queueManager.close();
  }

  private getJobId(steamid: SteamID): string {
    return this.getKey(steamid);
  }

  private getKey(steamid: SteamID): string {
    return `escrow:${steamid.getSteamID64()}`;
  }

  addJob(steamid: SteamID, dto: GetEscrowDto) {
    const jobId = this.getJobId(steamid);

    const options: EnqueueOptions = {
      bot: dto.bot ? dto.bot.getSteamID64() : undefined,
    };

    return this.queueManager.addJob(
      jobId,
      'load',
      {
        steamid64: steamid.getSteamID64(),
        token: dto.token,
      },
      options,
    );
  }

  removeJob(steamid: SteamID) {
    return this.queueManager.removeJobById(this.getJobId(steamid));
  }

  async getEscrow(
    steamid: SteamID,
    query: GetEscrowDto,
  ): Promise<EscrowResponse> {
    assert(
      query.token !== undefined || query.bot !== undefined,
      'Either token or bot must be provided',
    );

    try {
      const cached = await this.getEscrowFromCache(steamid);
      return cached;
    } catch (err) {
      if (!(err instanceof NotFoundException)) {
        throw err;
      }
    }

    const job = await this.addJob(steamid, query);

    await this.queueManager.waitUntilFinished(job, 10000);

    return this.getEscrowFromCache(steamid);
  }

  async getEscrowFromBot(
    bot: Bot,
    steamid: SteamID,
    token?: string,
  ): Promise<GetEscrowResponse> {
    const response = await firstValueFrom(
      this.httpService.get<GetEscrowResponse>(
        `http://${bot.ip}:${bot.port}${ESCROW_BASE_URL}${ESCROW_GET_DURATION}`.replace(
          ':steamid',
          steamid.getSteamID64(),
        ),
        {
          params: {
            token,
          },
        },
      ),
    );

    return response.data;
  }

  async getEscrowFromCache(steamid: SteamID): Promise<EscrowResponse> {
    const key = this.getKey(steamid);

    const [ttl, object] = await Promise.all([
      this.redis.ttl(key),
      this.redis.hgetallBuffer(key),
    ]);

    if (ttl === -2 || object === null) {
      throw new NotFoundException('Escrow not found');
    }

    if (object.error) {
      const error = unpack(object.error);
      throw new HttpException(error.message, error.statusCode);
    } else if (!object.result) {
      throw new NotFoundException('Escrow not found');
    }

    const timestamp = parseInt(object.timestamp.toString(), 10);
    const result = unpack(object.result) as GetEscrowResponse;

    return {
      timestamp,
      ttl,
      escrowDays: result.escrowDays,
    };
  }

  async saveEscrow(steamid: SteamID, result: EscrowResult): Promise<void> {
    const key = this.getKey(steamid);

    const save: EscrowData = {
      timestamp: result.timestamp,
    };

    if (result.result) {
      save.result = pack(result.result);
    }

    let ttl = ESCROW_EXPIRE_TIME;

    if (result.error) {
      save.error = pack(result.error);
      if (result.error.statusCode === 400) {
        // Error 400 should not be retried so we set a longer ttl
        ttl = ESCROW_EXPIRE_TIME_LONG;
      }
    }

    await this.redis.pipeline().del(key).hset(key, save).expire(key, ttl).exec();
  }

  async deleteEscrow(steamid: SteamID): Promise<void> {
    await this.redis.del(this.getKey(steamid));
  }
}
