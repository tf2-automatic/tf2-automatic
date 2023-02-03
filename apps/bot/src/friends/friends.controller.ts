import { Controller, Post, Delete, Get, Param } from '@nestjs/common';
import SteamID from 'steamid';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import { FriendsService } from './friends.service';
import {
  Friends,
  Friend,
  AddFriend,
  DeleteFriend,
  basePath,
  addFriendPath,
  deleteFriendPath,
  getFriendsPath,
} from '@tf2-automatic/bot-data';

@Controller(basePath)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  getFriends(): Promise<Friends> {
    return this.friendsService.getFriends();
  }

  @Post(addFriendPath)
  async addFriend(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID
  ): Promise<AddFriend> {
    const added = await this.friendsService.addFriend(steamid);

    return {
      added,
    };
  }

  @Delete(deleteFriendPath)
  async deleteFriend(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID
  ): Promise<DeleteFriend> {
    await this.friendsService.deleteFriend(steamid);

    return {
      deleted: true,
    };
  }

  @Get(getFriendsPath)
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
}
