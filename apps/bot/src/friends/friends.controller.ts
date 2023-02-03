import { Controller, Post, Delete, Get, Param } from '@nestjs/common';
import SteamID from 'steamid';
import { ParseSteamIDPipe } from '@tf2-automatic/nestjs-steamid-pipe';
import { FriendsService } from './friends.service';

@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  getFriends(): Promise<
    {
      steamid64: string;
      isFriend: boolean;
      isInvited: boolean;
      hasInvitedUs: boolean;
    }[]
  > {
    return this.friendsService.getFriends();
  }

  @Post('/:steamid')
  async addFriend(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID
  ): Promise<{ added: boolean }> {
    const added = await this.friendsService.addFriend(steamid);

    return {
      added,
    };
  }

  @Delete('/:steamid')
  async deleteFriend(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID
  ): Promise<{ deleted: boolean }> {
    await this.friendsService.deleteFriend(steamid);

    return {
      deleted: true,
    };
  }

  @Get('/:steamid')
  async isFriend(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID
  ): Promise<{
    isFriend: boolean;
    isInvited: boolean;
    hasInvitedUs: boolean;
  }> {
    const [isFriend, isInvited, hasInvitedUs] = await Promise.all([
      this.friendsService.isFriend(steamid),
      this.friendsService.isInvited(steamid),
      this.friendsService.hasInvitedUs(steamid),
    ]);

    return {
      isFriend,
      isInvited,
      hasInvitedUs,
    };
  }
}
