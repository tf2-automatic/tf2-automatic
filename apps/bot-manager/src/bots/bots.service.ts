import { Injectable } from '@nestjs/common';
import { Bot } from '@tf2-automatic/bot-manager-data';
import SteamID from 'steamid';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';
import {
  GetTradesResponse,
  OfferFilter,
  TRADES_FULL_PATH,
} from '@tf2-automatic/bot-data';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GetTradesDto } from '@tf2-automatic/dto';

@Injectable()
export class BotsService {
  constructor(
    private readonly heartbeatsService: HeartbeatsService,
    private readonly httpService: HttpService,
  ) {}

  getBot(steamid: SteamID): Promise<Bot> {
    return this.heartbeatsService.getBot(steamid);
  }

  getCachedBot(steamid: SteamID): Promise<Bot | null> {
    return this.heartbeatsService.getCachedBot(steamid);
  }

  getBots(): Promise<Bot[]> {
    return this.heartbeatsService.getBots();
  }

  deleteBot(steamid: SteamID): Promise<void> {
    return this.heartbeatsService.deleteBot(steamid);
  }

  async getActiveOffers(bot: Bot): Promise<GetTradesResponse> {
    return this.getOffers(bot, OfferFilter.ActiveOnly);
  }

  async getOffers(bot: Bot, filter: OfferFilter): Promise<GetTradesResponse> {
    const dto: GetTradesDto = new GetTradesDto();
    dto.filter = filter;
    dto.useCache = true;

    const response = await firstValueFrom(
      this.httpService.get<GetTradesResponse>(
        `http://${bot.ip}:${bot.port}${TRADES_FULL_PATH}`,
        { params: dto },
      ),
    );

    return response.data;
  }
}
