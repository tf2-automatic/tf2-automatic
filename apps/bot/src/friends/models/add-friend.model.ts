import { ApiProperty } from '@nestjs/swagger';
import { AddFriendResponse } from '@tf2-automatic/bot-data';

export class AddFriendModel implements AddFriendResponse {
  @ApiProperty({
    example: true,
    description:
      'True if the bot now sent a friend request to the user, false if one was already sent',
  })
  added: boolean;
}
