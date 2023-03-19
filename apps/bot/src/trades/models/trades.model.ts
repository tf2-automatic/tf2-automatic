import { ApiProperty } from '@nestjs/swagger';
import { GetTradesResponse } from '@tf2-automatic/bot-data';
import { TradeModel } from './trade.model';

export class TradesModel implements GetTradesResponse {
  @ApiProperty({
    description: 'Sent trades',
    type: [TradeModel],
  })
  sent: TradeModel[];

  @ApiProperty({
    description: 'Received trades',
    type: [TradeModel],
  })
  received: TradeModel[];
}
