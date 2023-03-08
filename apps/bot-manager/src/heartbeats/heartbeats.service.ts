import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Bot } from '@tf2-automatic/bot-manager-data';
import {
  Bot as RunningBot,
  BOT_BASE_URL,
  BOT_PATH,
} from '@tf2-automatic/bot-data';
import { Redis } from 'ioredis';
import { firstValueFrom } from 'rxjs';
import SteamID from 'steamid';
import { ConfigService } from '@nestjs/config';
import { Config, RedisConfig } from '../common/config/configuration';
import { BotHeartbeatDto } from './dto/bot-heartbeat.dto';

const BOT_PREFIX = 'bots';
const BOT_KEY = `${BOT_PREFIX}:STEAMID64`;

@Injectable()
export class HeartbeatsService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService<Config>,
    private readonly httpService: HttpService
  ) {}

  getBots(): Promise<Bot[]> {
    const keyPrefix =
      this.configService.getOrThrow<RedisConfig>('redis').keyPrefix;

    return this.redis.keys(`${keyPrefix}${BOT_PREFIX}:*`).then((keys) => {
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

      return this.redis.mget(botKeys).then((result) => {
        const filtered = result.filter((bot) => bot !== null) as string[];
        return filtered.map((bot) => JSON.parse(bot));
      });
    });
  }

  async getBot(steamid: SteamID): Promise<Bot> {
    const bot = await this.redis
      .get(BOT_KEY.replace('STEAMID64', steamid.getSteamID64()))
      .then((result) => {
        if (result === null) {
          return null;
        }

        return JSON.parse(result);
      });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    // Check if the bot is alive / ip + port combination is valid
    const running = await this.getRunningBot(bot);

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
      lastSeen: Math.floor(Date.now() / 1000),
    };

    const running = await this.getRunningBot(bot);

    if (running === null || running.steamid64 !== bot.steamid64) {
      throw new BadRequestException('IP and port is not used for this bot');
    }

    // TODO: Make sure ip and port combination is unique

    await this.redis.set(
      BOT_KEY.replace('STEAMID64', steamid.getSteamID64()),
      JSON.stringify(bot),
      'EX',
      60
    );

    return bot;
  }

  async deleteBot(steamid: SteamID): Promise<void> {
    const result = await this.redis.del(steamid.getSteamID64());

    if (result === 0) {
      throw new NotFoundException('Bot not found');
    }
  }

  private async getRunningBot(bot: Bot): Promise<RunningBot | null> {
    const response = await firstValueFrom(
      this.httpService.get(
        `http://${bot.ip}:${bot.port}/${BOT_BASE_URL}${BOT_PATH}`,
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
