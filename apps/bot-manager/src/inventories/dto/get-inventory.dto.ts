import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';
import SteamID from 'steamid';

export class GetInventoryDto {
  @IsSteamID()
  @IsOptional()
  @Transform((params) => new SteamID(params.value))
  bot?: SteamID;
}
