import { ApiProperty } from '@nestjs/swagger';

export class TradeOfferUrlModel {
  @ApiProperty({
    description: 'The trade offer url',
    example:
      'https://steamcommunity.com/tradeoffer/new/?partner=159805178&token=_Eq1Y3An',
  })
  url: string;
}
