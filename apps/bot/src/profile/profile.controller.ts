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
  PROFILE_AVATAR_PATH,
  PROFILE_BASE_URL,
  PROFILE_NAME_PATH,
  PROFILE_PATH,
  PROFILE_SETTINGS_PATH,
  PROFILE_TRADEOFFERURL_PATH,
  TradeOfferUrlResponse,
  UpdateProfileAvatarDto,
  UpdateProfileDto,
  UpdateProfileSettingsDto,
} from '@tf2-automatic/bot-data';
import { ProfileService } from './profile.service';

@Controller(PROFILE_BASE_URL)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Put(PROFILE_AVATAR_PATH)
  setAvatar(
    @Body(new ValidationPipe()) dto: UpdateProfileAvatarDto
  ): Promise<void> {
    return this.profileService.setAvatar(dto);
  }

  @Put(PROFILE_PATH)
  editProfile(
    @Body(new ValidationPipe()) dto: UpdateProfileDto
  ): Promise<void> {
    return this.profileService.editProfile(dto);
  }

  @Put(PROFILE_SETTINGS_PATH)
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

  @Delete(PROFILE_NAME_PATH)
  deleteNameHistory(): Promise<void> {
    return this.profileService.deleteNameHistory();
  }

  @Get(PROFILE_TRADEOFFERURL_PATH)
  getTradeOfferUrl(): Promise<TradeOfferUrlResponse> {
    return this.profileService.getTradeOfferUrl().then((url) => {
      return {
        url,
      };
    });
  }

  @Post(PROFILE_TRADEOFFERURL_PATH)
  changeTradeOfferUrl(): Promise<TradeOfferUrlResponse> {
    return this.profileService.changeTradeOfferUrl().then((url) => {
      return { url };
    });
  }
}
