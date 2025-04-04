import {
  Bot as ManagerBot,
  BOTS_FULL_PATH,
  BOT_FULL_PATH,
  InventoryResponse,
  INVENTORY_FETCH_FULL_PATH,
} from '@tf2-automatic/bot-manager-data';
import { ConfigService } from '@nestjs/config';
import { Config } from '../common/config/configuration';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Injectable } from '@nestjs/common';
import SteamID from 'steamid';

@Injectable()
export class ManagerService {
  private managerUrl = this.configService.getOrThrow('manager').url;

  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly httpService: HttpService,
  ) {}

  async getRunningBots(): Promise<ManagerBot[]> {
    const bots = await this.getBots();
    return bots.filter((bot) => bot.running === true);
  }

  async getBots(): Promise<ManagerBot[]> {
    const url = this.getManagerUrl(BOTS_FULL_PATH);

    const response = await firstValueFrom(
      this.httpService.get<ManagerBot[]>(url),
    );

    return response.data;
  }

  async getBotBySteamID(steamid: SteamID): Promise<ManagerBot> {
    const url = this.getManagerUrl(
      BOT_FULL_PATH.replace(':steamid', steamid.toString()),
    );

    const response = await firstValueFrom(
      this.httpService.get<ManagerBot>(url),
    );

    return response.data;
  }

  async fetchInventoryBySteamID(
    steamid: SteamID,
    useCache = true,
  ): Promise<InventoryResponse> {
    const url = this.getManagerUrl(
      INVENTORY_FETCH_FULL_PATH.replace(':steamid', steamid.toString())
        .replace(':appid', '440')
        .replace(':contextid', '2'),
    );

    const response = await firstValueFrom(
      this.httpService.get<InventoryResponse>(url, {
        params: { tradableOnly: false, useCache },
      }),
    );

    return response.data;
  }

  private getManagerUrl(path: string): string {
    return `${this.managerUrl}${path}`;
  }
}
