import { ApiProperty } from '@nestjs/swagger';
import { SendFriendMessage } from '@tf2-automatic/bot-data';
import { IsNotEmpty, IsString } from 'class-validator';

export class SendFriendMessageDto implements SendFriendMessage {
  @ApiProperty({
    description: 'The message to send',
    example: 'Hello!',
  })
  @IsNotEmpty()
  @IsString()
  message: string;
}
