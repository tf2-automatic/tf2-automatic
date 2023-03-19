import { ApiProperty } from '@nestjs/swagger';
import { DeleteFriendResponse } from '@tf2-automatic/bot-data';

export class DeleteFriendModel implements DeleteFriendResponse {
  @ApiProperty({
    example: true,
    description:
      'True if the friend was deleted, false if the user was not a friend',
  })
  deleted: boolean;
}
