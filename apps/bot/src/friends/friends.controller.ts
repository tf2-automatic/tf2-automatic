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
  AddFriendResponse,
  DeleteFriendResponse,
  FRIENDS_BASE_URL,
  SendFriendMessageDto,
  SendFriendMessageResponse,
  FRIENDS_PATH,
  FRIEND_PATH,
  FRIEND_MESSAGE_PATH,
  FRIEND_TYPING_PATH,
  FRIEND_BLOCK_PATH,
} from '@tf2-automatic/bot-data';

@Controller(FRIENDS_BASE_URL)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get(FRIENDS_PATH)
  getFriends(): Promise<Friends> {
    return this.friendsService.getFriends();
  }

  @Post(FRIEND_PATH)
  @HttpCode(HttpStatus.OK)
  async addFriend(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID
  ): Promise<AddFriendResponse> {
    const added = await this.friendsService.addFriend(steamid);

    return {
      added,
    };
  }

  @Delete(FRIEND_PATH)
  async deleteFriend(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID
  ): Promise<DeleteFriendResponse> {
    await this.friendsService.deleteFriend(steamid);

    return {
      deleted: true,
    };
  }

  @Get(FRIEND_PATH)
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

  @Post(FRIEND_MESSAGE_PATH)
  sendMessage(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID,
    @Body(new ValidationPipe()) dto: SendFriendMessageDto
  ): Promise<SendFriendMessageResponse> {
    return this.friendsService.sendFriendMessage(steamid, dto.message);
  }

  @Post(FRIEND_TYPING_PATH)
  sendTyping(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID
  ): Promise<void> {
    return this.friendsService.sendFriendTyping(steamid);
  }

  @Post(FRIEND_BLOCK_PATH)
  blockUser(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID
  ): Promise<void> {
    return this.friendsService.blockUser(steamid);
  }

  @Delete(FRIEND_BLOCK_PATH)
  unblockUser(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID
  ): Promise<void> {
    return this.friendsService.unblockUser(steamid);
  }

  @Get(FRIEND_BLOCK_PATH)
  isBlocked(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID
  ): Promise<boolean> {
    return this.friendsService.isBlocked(steamid);
  }
}
