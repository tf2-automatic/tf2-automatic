import { CreateTrade } from '@tf2-automatic/bot-data';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Asset } from './asset.dto';

export class CreateTradeDto implements CreateTrade {
  @IsSteamID()
  partner: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsArray()
  @ValidateNested({
    each: true,
  })
  @Type(() => Asset)
  itemsToGive: Asset[];

  @IsArray()
  @ValidateNested({
    each: true,
  })
  @Type(() => Asset)
  itemsToReceive: Asset[];
}
