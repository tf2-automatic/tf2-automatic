import { EscrowResponse } from '@tf2-automatic/bot-manager-data';
import { ApiProperty } from '@nestjs/swagger';

export class EscrowModel implements EscrowResponse {
  @ApiProperty({
    example: true,
    description: 'If the inventory was cached',
  })
  cached: boolean;

  @ApiProperty({
    example: Math.floor(Date.now() / 1000),
    description: 'The timestamp of when the inventory was fetched',
  })
  timestamp: number;

  @ApiProperty({
    example: 0,
    description: 'The number of days a trade will be held in escrow',
  })
  escrowDays: number;
}
