import { ApiProperty } from '@nestjs/swagger';
import { TF2Account } from '@tf2-automatic/bot-data';

export class TF2AccountModel implements TF2Account {
  @ApiProperty({
    example: true,
    description: 'Whether the account is premium or not',
  })
  isPremium: boolean;

  @ApiProperty({
    example: 3000,
    description: 'The number of inventory slots the account has',
  })
  backpackSlots: number;
}
