import { SendFriendMessage } from '@tf2-automatic/bot-data';
import { IsNotEmpty, IsString } from 'class-validator';

export class SendFriendMessageDto implements SendFriendMessage {
  @IsNotEmpty()
  @IsString()
  message: string;
}
