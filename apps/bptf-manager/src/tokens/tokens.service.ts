import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRedis } from '@songkeys/nestjs-redis';
import { SaveTokenDto, Token } from '@tf2-automatic/bptf-manager-data';
import { Redis } from 'ioredis';
import SteamID from 'steamid';

const KEY_PREFIX = 'bptf-manager:data:';

@Injectable()
export class TokensService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async saveToken(dto: SaveTokenDto): Promise<void> {
    await this.redis.set(this.getKey(dto.steamid64), dto.token);
  }

  async deleteToken(steamid: SteamID): Promise<void> {
    const deleted = await this.redis.del(this.getKey(steamid.getSteamID64()));

    if (!deleted) {
      throw new NotFoundException('Token not found');
    }
  }

  async getToken(steamid: SteamID): Promise<Token> {
    const steamid64 = steamid.getSteamID64();

    const token = await this.redis.get(this.getKey(steamid64));

    if (!token) {
      throw new NotFoundException('Token not found');
    }

    return {
      steamid64,
      token,
    };
  }

  async getRandomToken(): Promise<Token> {
    const steamid64s = await this.getSteamIDs();

    if (steamid64s.length === 0) {
      throw new BadRequestException('No tokens found');
    }

    const steamid64 = steamid64s[Math.floor(Math.random() * steamid64s.length)];

    const token = await this.getToken(new SteamID(steamid64));

    if (!token) {
      return this.getRandomToken();
    }

    return token;
  }

  async getSteamIDs(): Promise<string[]> {
    const keys = await this.redis.keys(
      this.redis.options.keyPrefix + this.getKey('*'),
    );

    if (!keys.length) {
      return [];
    }

    return keys.map((key) => key.split(':').pop() as string);
  }

  async getTokens(): Promise<Token[]> {
    const steamid64s = await this.getSteamIDs();

    if (!steamid64s.length) {
      return [];
    }

    const tokens = await this.redis.mget(
      steamid64s.map((steamid64) => this.getKey(steamid64)),
    );

    return steamid64s
      .map((steamid64, index) => {
        return {
          steamid64,
          token: tokens[index],
        };
      })
      .filter((element): element is Token => element.token !== null);
  }

  private getKey(steamid64: string) {
    return KEY_PREFIX + 'tokens:' + steamid64;
  }
}
