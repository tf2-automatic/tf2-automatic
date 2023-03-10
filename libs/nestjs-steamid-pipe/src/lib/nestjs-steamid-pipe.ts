import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import SteamID from 'steamid';
import { isSteamID } from '@tf2-automatic/is-steamid-validator';

@Injectable()
export class ParseSteamIDPipe implements PipeTransform {
  transform(value: unknown): SteamID {
    if (isSteamID(value)) {
      return new SteamID((value ?? '').toString());
    } else {
      throw new BadRequestException('Invalid SteamID');
    }
  }
}
