import { ApiProperty } from '@nestjs/swagger';
import { Friend } from '@tf2-automatic/bot-data';

export class FriendModel implements Friend {
  @ApiProperty({
    example: '76561198120070906',
  })
  steamid64: string;

  @ApiProperty({
    example: true,
    description: 'If the bot is friends with the user',
  })
  isFriend: boolean;

  @ApiProperty({
    example: false,
    description: 'If the bot has invited the user',
  })
  isInvited: boolean;

  @ApiProperty({
    example: false,
    description: 'If the user has invited the bot',
  })
  hasInvitedUs: boolean;
}
