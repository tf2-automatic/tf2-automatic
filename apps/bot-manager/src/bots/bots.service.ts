import { Injectable } from '@nestjs/common';
import { Bot } from '@tf2-automatic/bot-manager-data';
import SteamID from 'steamid';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';

@Injectable()
export class BotsService {
  constructor(private readonly heartbeatsService: HeartbeatsService) {}

  getBot(steamid: SteamID): Promise<Bot> {
    return this.heartbeatsService.getBot(steamid);
  }

  getBots(): Promise<Bot[]> {
    return this.heartbeatsService.getBots();
  }

  deleteBot(steamid: SteamID): Promise<void> {
    return this.heartbeatsService.deleteBot(steamid);
  }
}
