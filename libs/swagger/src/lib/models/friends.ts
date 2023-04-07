import { ApiProperty } from '@nestjs/swagger';
import {
  AddFriendResponse,
  DeleteFriendResponse,
  Friend,
} from '@tf2-automatic/bot-data';
import SteamUser from 'steam-user';

export class AddFriendModel implements AddFriendResponse {
  @ApiProperty({
    example: true,
    description:
      'True if the bot now sent a friend request to the user, false if one was already sent',
  })
  added: boolean;
}

export class DeleteFriendModel implements DeleteFriendResponse {
  @ApiProperty({
    example: true,
    description:
      'True if the friend was deleted, false if the user was not a friend',
  })
  deleted: boolean;
}

export class FriendModel implements Friend {
  @ApiProperty({
    example: '76561198120070906',
  })
  steamid64: string;

  @ApiProperty({
    example: SteamUser.EFriendRelationship.Friend,
    description: 'The relationship the bot has with the user',
    enum: SteamUser.EFriendRelationship,
  })
  relationship: SteamUser.EFriendRelationship;
}

export class MessageModel {
  @ApiProperty({
    description: 'The message as it was sent by Steam',
  })
  modified_message: string;

  @ApiProperty({
    description: 'Unix timestamp of when the message was sent',
  })
  server_timestamp: number;

  @ApiProperty({
    description:
      'This is a number incremented for each message sent at the same timestamp starting at 0',
  })
  ordinal: number;
}
