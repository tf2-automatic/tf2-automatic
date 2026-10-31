import { RedisService } from '@liaoliaots/nestjs-redis';
import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  Bot,
  BOT_DELETED_EVENT,
  BOT_HEARTBEAT_EVENT,
  BOT_STOPPED_EVENT,
  BotDeletedEvent,
  BotHeartbeatEvent,
  BotStoppedEvent,
} from '@tf2-automatic/bot-manager-data';
import {
  Bot as RunningBot,
  BOT_BASE_URL,
  BOT_PATH,
} from '@tf2-automatic/bot-data';
import { Redis } from 'ioredis';
import { firstValueFrom } from 'rxjs';
import SteamID from 'steamid';
import { BotHeartbeatDto } from '@tf2-automatic/dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { HeartbeatsQueue } from './interfaces/queue.interface';
import { LockDuration, Locker } from '@tf2-automatic/locking';
import { pack, unpack } from 'msgpackr';
import { RelayService } from '@tf2-automatic/nestjs-relay';
import { AxiosError } from 'axios';
import { getBotUrl } from './heartbeats.utils';
import {
  CustomHttpException,
  promoteOfflineBotJobs,
} from '@tf2-automatic/queue';

export class BotNotFoundException extends CustomHttpException {
  constructor() {
    super('Bot not found', HttpStatus.NOT_FOUND, true);
  }
}

export class BotNotRunningException extends CustomHttpException {
  constructor() {
    super('Bot is not running', HttpStatus.SERVICE_UNAVAILABLE, true);
  }
}

const BOT_PREFIX = 'bots';
const BOT_KEY = `${BOT_PREFIX}:STEAMID64`;

@Injectable()
export class HeartbeatsService {
  private readonly logger = new Logger(HeartbeatsService.name);
  private readonly locker: Locker;

  private readonly redis: Redis = this.redisService.getOrThrow();

  constructor(
    private readonly redisService: RedisService,
    private readonly httpService: HttpService,
    @InjectQueue('heartbeats')
    private readonly heartbeatsQueue: Queue<HeartbeatsQueue>,
    private readonly relayService: RelayService,
    @InjectQueue('trades') private readonly tradesQueue: Queue,
    @InjectQueue('inventories') private readonly inventoriesQueue: Queue,
    @InjectQueue('escrow') private readonly escrowQueue: Queue,
  ) {
    this.locker = new Locker(this.redis);
  }

  getBots(): Promise<Bot[]> {
    return this.redis
      .keys(`${this.redis.options.keyPrefix}${BOT_PREFIX}:*`)
      .then((keys) => {
        if (keys.length === 0) {
          return [];
        }

        const botKeys = keys
          .map((key) => {
            const steamid = key.split(':').pop();
            return new SteamID(steamid as string);
          })
          .map((steamid) => {
            return BOT_KEY.replace('STEAMID64', steamid.getSteamID64());
          });

        return this.redis.mgetBuffer(botKeys).then((result) => {
          const filtered = result.filter((bot) => bot !== null);
          return filtered.map((bot) => unpack(bot));
        });
      });
  }

  async getRunningBots(): Promise<Bot[]> {
    const bots = await this.getBots();
    return bots.filter((bot) => bot.running === true);
  }

  async getCachedBot(steamid: SteamID): Promise<Bot | null> {
    const bot = await this.redis
      .getBuffer(BOT_KEY.replace('STEAMID64', steamid.getSteamID64()))
      .then((result) => {
        if (result === null) {
          return null;
        }

        return unpack(result);
      });

    return bot;
  }

  async isBotStopped(steamid: SteamID): Promise<boolean> {
    const bot = await this.getCachedBot(steamid);
    return bot?.running === false;
  }

  async getBot(steamid: SteamID): Promise<Bot> {
    const bot = await this.getCachedBot(steamid);
    if (!bot) {
      throw new BotNotFoundException();
    }

    if (bot.running === false) {
      throw new BotNotRunningException();
    }

    // Check if the bot is alive / ip + port combination is valid
    const running = await this.getRunningBot(bot);

    if (running === null || running.steamid64 !== bot.steamid64) {
      // Bot is not the same as we thought it was
      return this.markStopped(steamid, false, bot.lastSeen).then(() => {
        throw new BotNotFoundException();
      });
    }

    return bot;
  }

  async saveBot(steamid: SteamID, heartbeat: BotHeartbeatDto): Promise<Bot> {
    const bot: Bot = {
      steamid64: steamid.getSteamID64(),
      host: heartbeat.host,
      port: heartbeat.port,
      version: heartbeat.version ?? null,
      interval: heartbeat.interval,
      running: true,
      lastSeen: Math.floor(Date.now() / 1000),
    };

    // Create lock to make sure that a bot can't be saved and deleted at the same time
    return this.locker.using(
      [`bots:${steamid.getSteamID64()}`],
      LockDuration.SHORT,
      async (signal) => {
        const existing = await this.getCachedBot(steamid);

        const running = await this.getRunningBot(bot);

        if (running === null || running.steamid64 !== bot.steamid64) {
          throw new BadRequestException('IP and port is not used for this bot');
        }

        if (signal.aborted) {
          throw signal.error;
        }

        // Only drop the old job once the new heartbeat is accepted
        if (existing) {
          await this.deleteHeartbeatJobIfExists(existing);
        }

        // TODO: Make sure ip and port combination is unique

        // Add bot to queue to check if it is still alive in the future
        await this.heartbeatsQueue.add(bot.steamid64, bot, {
          jobId: this.getJobId(new SteamID(bot.steamid64), bot.lastSeen),
          delay: Math.floor(bot.interval * 1.5),
        });

        const multi = this.redis
          .multi()
          // Save bot
          .set(BOT_KEY.replace('STEAMID64', steamid.getSteamID64()), pack(bot));

        this.relayService.publishEvent<BotHeartbeatEvent>(
          multi,
          BOT_HEARTBEAT_EVENT,
          bot,
          steamid,
        );

        await multi.exec();

        await this.promoteDelayedJobs(bot.steamid64);

        return bot;
      },
    );
  }

  // Runs every heartbeat so jobs delayed in a race are picked up too
  private promoteDelayedJobs(steamid64: string): Promise<void> {
    return Promise.all(
      [this.tradesQueue, this.inventoriesQueue, this.escrowQueue].map((queue) =>
        promoteOfflineBotJobs(queue, steamid64),
      ),
    ).then(
      () => undefined,
      (err) => {
        this.logger.error('Failed to promote delayed jobs');
        console.error(err);
      },
    );
  }

  async markStopped(
    steamid: SteamID,
    isStopSignal: boolean,
    expectedLastSeen?: number,
  ): Promise<void> {
    // Create lock
    await this.locker.using(
      [`bots:${steamid.getSteamID64()}`],
      LockDuration.SHORT,
      async (signal) => {
        const bot = await this.getCachedBot(steamid);
        if (bot === null) {
          // Bot does not exist
          throw new BotNotFoundException();
        }

        // A newer heartbeat won the race, keep the bot running
        if (
          expectedLastSeen !== undefined &&
          bot.lastSeen !== expectedLastSeen
        ) {
          return;
        }

        await this.deleteHeartbeatJobIfExists(bot);

        if (signal.aborted) {
          throw signal.error;
        }

        // Mark bot as stopped
        bot.running = false;
        if (isStopSignal) {
          // Update last seen
          bot.lastSeen = Math.floor(Date.now() / 1000);
        }

        // Create event
        const multi = this.redis
          .multi()
          .set(BOT_KEY.replace('STEAMID64', steamid.getSteamID64()), pack(bot));

        this.relayService.publishEvent<BotStoppedEvent>(
          multi,
          BOT_STOPPED_EVENT,
          bot,
          steamid,
        );

        await multi.exec();
      },
    );
  }

  async deleteBot(steamid: SteamID): Promise<void> {
    // Create lock
    await this.locker.using(
      [`bots:${steamid.getSteamID64()}`],
      LockDuration.SHORT,
      async (signal) => {
        const bot = await this.getCachedBot(steamid);
        if (bot === null) {
          // Bot does not exist
          throw new BotNotFoundException();
        }

        if (signal.aborted) {
          throw signal.error;
        }

        // Delete bot and create event
        const multi = this.redis
          .multi()
          .del(BOT_KEY.replace('STEAMID64', steamid.getSteamID64()));

        this.relayService.publishEvent<BotDeletedEvent>(
          multi,
          BOT_DELETED_EVENT,
          bot,
          steamid,
        );

        await multi.exec();
      },
    );
  }

  private getHeartbeatJob(bot: Bot): Promise<Job | undefined> {
    return this.heartbeatsQueue.getJob(
      this.getJobId(new SteamID(bot.steamid64), bot.lastSeen),
    );
  }

  private async deleteHeartbeatJobIfExists(bot: Bot): Promise<void> {
    const job = await this.getHeartbeatJob(bot).catch(() => null);
    if (job) {
      // Remove job from queue, ignore errors
      await job.remove().catch(() => undefined);
    }
  }

  private async getRunningBot(bot: Bot): Promise<RunningBot | null> {
    const response = await firstValueFrom(
      this.httpService.get(`${getBotUrl(bot)}${BOT_BASE_URL}${BOT_PATH}`, {
        timeout: 5000,
      }),
    ).catch((err) => {
      if (err.code === 'ECONNREFUSED') {
        return null;
      }

      let errorMessage: string | null = null;

      if (err instanceof AxiosError && err.response) {
        errorMessage = err.response.data.message ?? err.message;
      }

      if (errorMessage) {
        this.logger.warn('Bot is inaccessible (' + errorMessage + ')');
        throw new CustomHttpException(
          'Bot is inaccessible (' + errorMessage + ')',
          HttpStatus.FAILED_DEPENDENCY,
          true,
        );
      }

      throw err;
    });

    if (response === null) {
      return null;
    }

    return response.data;
  }

  private getJobId(steamid: SteamID, lastSeen: number): string {
    return `${steamid.getSteamID64()}_${lastSeen}`;
  }
}
