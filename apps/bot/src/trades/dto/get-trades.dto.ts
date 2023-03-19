import { ApiProperty } from '@nestjs/swagger';
import { GetTrades, OfferFilter } from '@tf2-automatic/bot-data';
import { Type } from 'class-transformer';
import { IsEnum } from 'class-validator';

export class GetTradesDto implements GetTrades {
  @ApiProperty({
    enum: OfferFilter,
    description: 'Filter the trades',
    example: OfferFilter.ActiveOnly,
  })
  @IsEnum(OfferFilter)
  @Type(() => Number)
  filter: OfferFilter;
}
