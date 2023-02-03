import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import SteamID from 'steamid';

@Injectable()
export class ParseSteamIDPipe implements PipeTransform {
  transform(value: any): SteamID {
    let steamid: SteamID | null;
    try {
      steamid = new SteamID(value);
    } catch (err) {
      if (err.message.startsWith('Unknown SteamID input format')) {
        throw new BadRequestException('Unknown SteamID input format');
      }

      throw err;
    }

    if (steamid.isValid()) {
      return steamid;
    } else {
      throw new BadRequestException('Invalid SteamID');
    }
  }
}
