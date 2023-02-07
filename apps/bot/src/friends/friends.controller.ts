import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  HttpStatus,
  HttpCode,
  Body,
  ValidationPipe,
} from '@nestjs/common';
import SteamID from 'steamid';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import { FriendsService } from './friends.service';
import {
  Friends,
  Friend,
  AddFriend,
  DeleteFriend,
  ADD_FRIEND,
  DELETE_FRIEND,
  FRIENDS_BASE_PATH,
  GET_FRIEND,
  GET_FRIENDS,
  SendFriendMessageDto,
  SendFriendMessageResponse,
  SEND_FRIEND_MESSAGE,
  SEND_FRIEND_TYPING,
} from '@tf2-automatic/bot-data';

@Controller(FRIENDS_BASE_PATH)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get(GET_FRIENDS)
  getFriends(): Promise<Friends> {
    return this.friendsService.getFriends();
  }

  @Post(ADD_FRIEND)
  @HttpCode(HttpStatus.OK)
  async addFriend(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID
  ): Promise<AddFriend> {
    const added = await this.friendsService.addFriend(steamid);

    return {
      added,
    };
  }

  @Delete(DELETE_FRIEND)
  async deleteFriend(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID
  ): Promise<DeleteFriend> {
    await this.friendsService.deleteFriend(steamid);

    return {
      deleted: true,
    };
  }

  @Get(GET_FRIEND)
  async isFriend(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID
  ): Promise<Friend> {
    const [isFriend, isInvited, hasInvitedUs] = await Promise.all([
      this.friendsService.isFriend(steamid),
      this.friendsService.isInvited(steamid),
      this.friendsService.hasInvitedUs(steamid),
    ]);

    return {
      steamid64: steamid.getSteamID64(),
      isFriend,
      isInvited,
      hasInvitedUs,
    };
  }

  @Post(SEND_FRIEND_MESSAGE)
  sendMessage(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID,
    @Body(new ValidationPipe()) dto: SendFriendMessageDto
  ): Promise<SendFriendMessageResponse> {
    return this.friendsService.sendFriendMessage(steamid, dto.message);
  }

  @Post(SEND_FRIEND_TYPING)
  sendTyping(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID
  ): Promise<void> {
    return this.friendsService.sendFriendTyping(steamid);
  }
}
