import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Bot,
  BOT_DELETED_EVENT,
  BOT_HEARTBEAT_EVENT,
  BotDeletedEvent,
  BotHeartbeatEvent,
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
import { OUTBOX_KEY, OutboxMessage } from '@tf2-automatic/transactional-outbox';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { HeartbeatsQueue } from './interfaces/queue.interface';
import Redlock from 'redlock';

const KEY_PREFIX = 'bot-manager:data:';
const BOT_PREFIX = 'bots';
const BOT_KEY = `${BOT_PREFIX}:STEAMID64`;

@Injectable()
export class HeartbeatsService {
  private readonly logger = new Logger(HeartbeatsService.name);
  private readonly redlock: Redlock;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly httpService: HttpService,
    @InjectQueue('heartbeats')
    private readonly heartbeatsQueue: Queue<HeartbeatsQueue>
  ) {
    this.redlock = new Redlock([this.redis]);
  }

  getBots(): Promise<Bot[]> {
    return this.redis
      .keys(`${this.redis.options.keyPrefix}${KEY_PREFIX}${BOT_PREFIX}:*`)
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
            return (KEY_PREFIX + BOT_KEY).replace(
              'STEAMID64',
              steamid.getSteamID64()
            );
          });

        return this.redis.mget(botKeys).then((result) => {
          const filtered = result.filter((bot) => bot !== null) as string[];
          return filtered.map((bot) => JSON.parse(bot));
        });
      });
  }

  private async getBotFromRedis(steamid: SteamID): Promise<Bot | null> {
    const bot = await this.redis
      .get(KEY_PREFIX + BOT_KEY.replace('STEAMID64', steamid.getSteamID64()))
      .then((result) => {
        if (result === null) {
          return null;
        }

        return JSON.parse(result);
      });

    return bot;
  }

  async getBot(steamid: SteamID): Promise<Bot> {
    const bot = await this.getBotFromRedis(steamid);
    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    // Check if the bot is alive / ip + port combination is valid
    const running = await this.getRunningBot(bot).catch(() => {
      throw new InternalServerErrorException(
        'Bot ' + bot.steamid64 + ' is not accessible'
      );
    });

    if (running === null || running.steamid64 !== bot.steamid64) {
      // Bot is not the same as we thought it was
      return this.deleteBot(steamid).then(() => {
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
      interval: heartbeat.interval,
      lastSeen: Math.floor(Date.now() / 1000),
    };

    this.logger.debug(
      'Received heartbeat from bot ' +
        bot.steamid64 +
        ' at ' +
        bot.ip +
        ':' +
        bot.port
    );

    // Create lock to make sure that a bot can't be saved and deleted at the same time
    return this.redlock.using(
      [`bots:${steamid.getSteamID64()}`],
      1000,
      async (signal) => {
        const running = await this.getRunningBot(bot).catch((err) => {
          this.logger.warn('Bot is not accessible: ' + err.message);
          throw new InternalServerErrorException(
            'Bot ' + bot.steamid64 + ' is not accessible'
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

        await this.redis
          .multi()
          // Save bot
          .set(
            KEY_PREFIX + BOT_KEY.replace('STEAMID64', steamid.getSteamID64()),
            JSON.stringify(bot),
            'EX',
            300
          )
          // Add event to outbox
          .lpush(
            OUTBOX_KEY,
            JSON.stringify({
              type: BOT_HEARTBEAT_EVENT,
              data: bot satisfies BotHeartbeatEvent['data'],
              metadata: {
                steamid64: null,
                time: Math.floor(Date.now() / 1000),
              },
            } satisfies OutboxMessage)
          )
          // Publish that there is a new event
          .publish(OUTBOX_KEY, '')
          .exec();

        return bot;
      }
    );
  }

  async deleteBot(steamid: SteamID): Promise<void> {
    // Create lock
    await this.redlock.using(
      [`bots:${steamid.getSteamID64()}`],
      1000,
      async (signal) => {
        const bot = await this.getBotFromRedis(steamid);
        if (bot === null) {
          // Bot does not exist
          throw new NotFoundException('Bot not found');
        }

        if (signal.aborted) {
          throw signal.error;
        }

        // Delete bot and add event to outbox
        await this.redis
          .multi()
          .del(
            KEY_PREFIX + BOT_KEY.replace('STEAMID64', steamid.getSteamID64())
          )
          .lpush(
            OUTBOX_KEY,
            JSON.stringify({
              type: BOT_DELETED_EVENT,
              data: bot satisfies BotDeletedEvent['data'],
              metadata: {
                steamid64: null,
                time: Math.floor(Date.now() / 1000),
              },
            } satisfies OutboxMessage)
          )
          .publish(OUTBOX_KEY, '')
          .exec();
      }
    );
  }

  private async getRunningBot(bot: Bot): Promise<RunningBot | null> {
    const response = await firstValueFrom(
      this.httpService.get(
        `http://${bot.ip}:${bot.port}${BOT_BASE_URL}${BOT_PATH}`,
        {
          timeout: 5000,
        }
      )
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
