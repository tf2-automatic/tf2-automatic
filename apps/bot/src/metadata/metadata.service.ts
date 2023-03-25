import { Injectable } from '@nestjs/common';
import SteamID from 'steamid';

@Injectable()
export class MetadataService {
  private steamid: SteamID | null = null;

  setSteamID(steamid: SteamID): void {
    this.steamid = steamid;
  }

  getSteamID(): SteamID | null {
    return this.steamid;
  }

  getOrThrowSteamID(): SteamID {
    if (!this.steamid) {
      throw new Error('SteamID is not set');
    }

    return this.steamid;
  }
}
