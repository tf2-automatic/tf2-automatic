import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Post,
  Put,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  PROFILE_AVATAR_PATH,
  PROFILE_BASE_URL,
  PROFILE_CUSTOM_GAME_PATH,
  PROFILE_CUSTOM_PERSONA_STATE_PATH,
  PROFILE_GAMES_PATH,
  PROFILE_NAME_PATH,
  PROFILE_PATH,
  PROFILE_SETTINGS_PATH,
  PROFILE_TRADEOFFERURL_PATH,
  TradeOfferUrlResponse,
} from '@tf2-automatic/bot-data';
import {
  UpdateCustomGameDto,
  UpdateCustomPersonaStateDto,
  UpdateGamesDto,
  UpdateProfileAvatarDto,
  UpdateProfileDto,
  UpdateProfileSettingsDto,
} from '@tf2-automatic/dto';
import { TradeOfferUrlModel } from '@tf2-automatic/swagger';
import { ProfileService } from './profile.service';

@ApiTags('Profile')
@Controller(PROFILE_BASE_URL)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Put(PROFILE_AVATAR_PATH)
  @ApiOperation({
    summary: 'Set avatar',
    description: 'Set the bot avatar',
  })
  @ApiBody({
    type: UpdateProfileAvatarDto,
  })
  setAvatar(
    @Body(new ValidationPipe()) dto: UpdateProfileAvatarDto,
  ): Promise<void> {
    return this.profileService.setAvatar(dto);
  }

  @Put(PROFILE_PATH)
  @ApiOperation({
    summary: 'Edit profile',
    description: 'Edit the bot profile',
  })
  @ApiBody({
    type: UpdateProfileDto,
  })
  editProfile(
    @Body(new ValidationPipe()) dto: UpdateProfileDto,
  ): Promise<void> {
    return this.profileService.editProfile(dto);
  }

  @Put(PROFILE_SETTINGS_PATH)
  @ApiOperation({
    summary: 'Edit profile settings',
    description: 'Edit the bot profile settings',
  })
  @ApiBody({
    type: UpdateProfileSettingsDto,
  })
  editProfileSettings(
    @Body(
      new ValidationPipe({
        transform: true,
      }),
    )
    dto: UpdateProfileSettingsDto,
  ): Promise<void> {
    return this.profileService.editProfileSettings(dto);
  }

  @Delete(PROFILE_NAME_PATH)
  @ApiOperation({
    summary: 'Delete name history',
    description: 'Delete the bot name history',
  })
  deleteNameHistory(): Promise<void> {
    return this.profileService.deleteNameHistory();
  }

  @Get(PROFILE_TRADEOFFERURL_PATH)
  @ApiOperation({
    summary: 'Get trade offer url',
    description: 'Get the bot trade offer url',
  })
  @ApiOkResponse({
    type: TradeOfferUrlModel,
  })
  getTradeOfferUrl(): Promise<TradeOfferUrlResponse> {
    return this.profileService.getTradeOfferUrl().then((url) => {
      return {
        url,
      };
    });
  }

  @Post(PROFILE_TRADEOFFERURL_PATH)
  @ApiOperation({
    summary: 'Change trade offer url',
    description: 'Change the bot trade offer url',
  })
  @ApiResponse({
    type: TradeOfferUrlModel,
    status: HttpStatus.CREATED,
  })
  changeTradeOfferUrl(): Promise<TradeOfferUrlResponse> {
    return this.profileService.changeTradeOfferUrl().then((url) => {
      return { url };
    });
  }

  @Put(PROFILE_CUSTOM_GAME_PATH)
  @ApiOperation({
    summary: 'Set a custom game',
    description: 'Set a custom game for the bot',
  })
  @ApiBody({
    type: UpdateCustomGameDto,
  })
  setCustomGame(@Body(new ValidationPipe()) dto: UpdateCustomGameDto) {
    return this.profileService.setCustomGame(dto);
  }

  @Delete(PROFILE_CUSTOM_GAME_PATH)
  @ApiOperation({
    summary: 'Clear the custom game',
    description: "Clear the bot's custom game",
  })
  clearCustomGame() {
    return this.profileService.clearCustomGame();
  }

  @Put(PROFILE_GAMES_PATH)
  @ApiOperation({
    summary: 'Set a list of games to play',
    description: 'Sets a list of games for the bot to play',
  })
  @ApiBody({
    type: UpdateGamesDto,
  })
  setGames(@Body(new ValidationPipe()) dto: UpdateGamesDto) {
    return this.profileService.setGames(dto);
  }

  @Put(PROFILE_CUSTOM_PERSONA_STATE_PATH)
  @ApiOperation({
    summary: 'Set a custom persona state',
    description: 'Set a custom persona state for the bot',
  })
  @ApiBody({
    type: UpdateCustomPersonaStateDto,
  })
  setCustomPersonaState(
    @Body(new ValidationPipe()) dto: UpdateCustomPersonaStateDto,
  ) {
    return this.profileService.setCustomPersonaState(dto.state);
  }

  @Delete(PROFILE_CUSTOM_PERSONA_STATE_PATH)
  @ApiOperation({
    summary: 'Clear the custom persona state',
    description:
      "Clear the bot's custom persona state and return to Online/Offline only",
  })
  clearCustomPersonaState() {
    return this.profileService.clearCustomPersonaState();
  }
}
