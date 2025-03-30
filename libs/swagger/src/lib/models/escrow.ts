import { EscrowResponse } from '@tf2-automatic/bot-manager-data';
import { ApiProperty } from '@nestjs/swagger';

export class EscrowModel implements EscrowResponse {
  @ApiProperty({
    example: Math.floor(Date.now() / 1000),
    description: 'The timestamp of when the inventory was fetched',
    type: 'integer',
  })
  timestamp: number;

  @ApiProperty({
    example: 3600,
    description: 'The time to live of the cache in seconds',
    type: 'integer',
  })
  ttl: number;

  @ApiProperty({
    example: 0,
    description: 'The number of days a trade will be held in escrow',
    type: 'integer',
  })
  escrowDays: number;
}
