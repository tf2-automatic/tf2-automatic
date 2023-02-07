import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  ValidationPipe,
} from '@nestjs/common';
import {
  PROFILE_BASE_URL,
  PROFILE_CHANGE_TRADE_OFFER_URL,
  PROFILE_DELETE_NAME_HISTORY,
  PROFILE_GET_TRADE_OFFER_URL,
  PROFILE_UPDATE_AVATAR,
  PROFILE_UPDATE_PROFILE,
  PROFILE_UPDATE_PROFILE_SETTINGS,
  TradeOfferUrlResponse,
  UpdateProfileAvatarDto,
  UpdateProfileDto,
  UpdateProfileSettingsDto,
} from '@tf2-automatic/bot-data';
import { ProfileService } from './profile.service';

@Controller(PROFILE_BASE_URL)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Put(PROFILE_UPDATE_AVATAR)
  setAvatar(
    @Body(new ValidationPipe()) dto: UpdateProfileAvatarDto
  ): Promise<void> {
    return this.profileService.setAvatar(dto);
  }

  @Put(PROFILE_UPDATE_PROFILE)
  editProfile(
    @Body(new ValidationPipe()) dto: UpdateProfileDto
  ): Promise<void> {
    return this.profileService.editProfile(dto);
  }

  @Put(PROFILE_UPDATE_PROFILE_SETTINGS)
  editProfileSettings(
    @Body(
      new ValidationPipe({
        transform: true,
      })
    )
    dto: UpdateProfileSettingsDto
  ): Promise<void> {
    return this.profileService.editProfileSettings(dto);
  }

  @Delete(PROFILE_DELETE_NAME_HISTORY)
  deleteNameHistory(): Promise<void> {
    return this.profileService.deleteNameHistory();
  }

  @Get(PROFILE_GET_TRADE_OFFER_URL)
  getTradeOfferUrl(): Promise<TradeOfferUrlResponse> {
    return this.profileService.getTradeOfferUrl().then((url) => {
      return {
        url,
      };
    });
  }

  @Post(PROFILE_CHANGE_TRADE_OFFER_URL)
  changeTradeOfferUrl(): Promise<TradeOfferUrlResponse> {
    return this.profileService.changeTradeOfferUrl().then((url) => {
      return { url };
    });
  }
}
