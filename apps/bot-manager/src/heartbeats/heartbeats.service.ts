import { InjectRedis } from '@songkeys/nestjs-redis';
import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
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

const BOT_PREFIX = 'bots';
const BOT_KEY = `${BOT_PREFIX}:STEAMID64`;

@Injectable()
export class HeartbeatsService {
  private readonly logger = new Logger(HeartbeatsService.name);
  private readonly locker: Locker;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly httpService: HttpService,
    @InjectQueue('heartbeats')
    private readonly heartbeatsQueue: Queue<HeartbeatsQueue>,
    private readonly relayService: RelayService,
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

  async getBot(steamid: SteamID): Promise<Bot> {
    const bot = await this.getCachedBot(steamid);
    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    if (bot.running === false) {
      throw new ServiceUnavailableException('Bot is not running');
    }

    // Check if the bot is alive / ip + port combination is valid
    const running = await this.getRunningBot(bot).catch(() => {
      throw new InternalServerErrorException(
        'Bot ' + bot.steamid64 + ' is not accessible',
      );
    });

    if (running === null || running.steamid64 !== bot.steamid64) {
      // Bot is not the same as we thought it was
      return this.markStopped(steamid, false).then(() => {
        throw new NotFoundException('Bot not found');
      });
    }

    return bot;
  }

  async saveBot(steamid: SteamID, heartbeat: BotHeartbeatDto): Promise<Bot> {
    const bot: Bot = {
      steamid64: steamid.getSteamID64(),
      ip: heartbeat.ip,
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
        if (existing) {
          await this.deleteHeartbeatJobIfExists(existing);
        }

        const running = await this.getRunningBot(bot).catch((err) => {
          this.logger.warn('Bot is not accessible: ' + err.message);
          throw new InternalServerErrorException(
            'Bot ' + bot.steamid64 + ' is not accessible',
          );
        });

        if (running === null || running.steamid64 !== bot.steamid64) {
          throw new BadRequestException('IP and port is not used for this bot');
        }

        if (signal.aborted) {
          throw signal.error;
        }

        // TODO: Make sure ip and port combination is unique

        // Add bot to queue to check if it is still alive in the future
        await this.heartbeatsQueue.add(bot.steamid64, bot, {
          jobId: bot.steamid64 + ':' + bot.lastSeen,
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

        return bot;
      },
    );
  }

  async markStopped(steamid: SteamID, isStopSignal: boolean): Promise<void> {
    // Create lock
    await this.locker.using(
      [`bots:${steamid.getSteamID64()}`],
      LockDuration.SHORT,
      async (signal) => {
        const bot = await this.getCachedBot(steamid);
        if (bot === null) {
          // Bot does not exist
          throw new NotFoundException('Bot not found');
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
          throw new NotFoundException('Bot not found');
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
    return this.heartbeatsQueue.getJob(bot.steamid64 + ':' + bot.lastSeen);
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
      this.httpService.get(
        `http://${bot.ip}:${bot.port}${BOT_BASE_URL}${BOT_PATH}`,
        {
          timeout: 5000,
        },
      ),
    ).catch((err) => {
      if (err.code === 'ECONNREFUSED') {
        return null;
      }

      throw err;
    });

    if (response === null) {
      return null;
    }

    return response.data;
  }
}
