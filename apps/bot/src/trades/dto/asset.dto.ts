import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Asset as AssetInterface } from '@tf2-automatic/bot-data';

export class Asset implements AssetInterface {
  @IsString()
  assetid: string;

  @IsNumber()
  appid: number;

  @IsString()
  contextid: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;
}
