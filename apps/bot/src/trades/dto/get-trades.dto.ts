import { GetTrades, OfferFilter } from '@tf2-automatic/bot-data';
import { Type } from 'class-transformer';
import { IsEnum } from 'class-validator';

export class GetTradesDto implements GetTrades {
  @IsEnum(OfferFilter)
  @Type(() => Number)
  filter: OfferFilter;
}
