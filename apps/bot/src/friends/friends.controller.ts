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
  SendFriendMessageResponse,
  FRIENDS_PATH,
  FRIEND_PATH,
  FRIEND_MESSAGE_PATH,
  FRIEND_TYPING_PATH,
  FRIEND_BLOCK_PATH,
} from '@tf2-automatic/bot-data';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  FriendModel,
  AddFriendModel,
  DeleteFriendModel,
  MessageModel,
  ApiParamSteamID,
} from '@tf2-automatic/swagger';
import { SendFriendMessageDto } from '@tf2-automatic/dto';

@ApiTags('Friends')
@Controller(FRIENDS_BASE_URL)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get(FRIENDS_PATH)
  @ApiOperation({
    summary: 'Get friends',
    description: 'Get a list of users and their relationship to the bot',
  })
  @ApiOkResponse({
    type: [FriendModel],
  })
  getFriends(): Promise<Friends> {
    return this.friendsService.getFriends();
  }

  @Post(FRIEND_PATH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add friend',
    description: 'Send a friend request to a user',
  })
  @ApiParamSteamID()
  @ApiOkResponse({
    type: AddFriendModel,
  })
  async addFriend(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID,
  ): Promise<AddFriendResponse> {
    const added = await this.friendsService.addFriend(steamid);

    return {
      added,
    };
  }

  @Delete(FRIEND_PATH)
  @ApiOperation({
    summary: 'Delete friend',
    description:
      'Remove a user from your friends list or cancel a friend request',
  })
  @ApiParamSteamID()
  @ApiOkResponse({
    type: DeleteFriendModel,
  })
  async deleteFriend(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID,
  ): Promise<DeleteFriendResponse> {
    await this.friendsService.deleteFriend(steamid);

    return {
      deleted: true,
    };
  }

  @Get(FRIEND_PATH)
  @ApiOperation({
    summary: 'Get friend status of a Steam account',
    description: 'Get the friend relationship status of a Steam account',
  })
  @ApiParamSteamID()
  @ApiOkResponse({
    type: FriendModel,
  })
  async isFriend(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID,
  ): Promise<Friend> {
    return this.friendsService.getFriend(steamid);
  }

  @Post(FRIEND_MESSAGE_PATH)
  @ApiOperation({
    summary: 'Send chat message',
    description: 'Send a chat message to a Steam account',
  })
  @ApiParamSteamID()
  @ApiBody({
    type: SendFriendMessageDto,
  })
  @ApiOkResponse({
    type: MessageModel,
  })
  sendMessage(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID,
    @Body(new ValidationPipe()) dto: SendFriendMessageDto,
  ): Promise<SendFriendMessageResponse> {
    return this.friendsService.sendFriendMessage(steamid, dto.message);
  }

  @Post(FRIEND_TYPING_PATH)
  @ApiOperation({
    summary: 'Send typing notification',
    description: 'Send a typing notification to a Steam account',
  })
  @ApiParamSteamID()
  sendTyping(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID,
  ): Promise<void> {
    return this.friendsService.sendFriendTyping(steamid);
  }

  @Post(FRIEND_BLOCK_PATH)
  @ApiOperation({
    summary: 'Block a Steam account',
    description: 'Block a Steam account',
  })
  @ApiParamSteamID()
  blockUser(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID,
  ): Promise<void> {
    return this.friendsService.blockUser(steamid);
  }

  @Delete(FRIEND_BLOCK_PATH)
  @ApiOperation({
    summary: 'Unblock a Steam account',
    description: 'Unblock a Steam account',
  })
  @ApiParamSteamID()
  unblockUser(
    @Param('steamid', new ParseSteamIDPipe()) steamid: SteamID,
  ): Promise<void> {
    return this.friendsService.unblockUser(steamid);
  }
}
