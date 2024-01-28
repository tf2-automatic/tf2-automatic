import { Injectable } from '@nestjs/common';
import {
  UpdateCustomGameDto,
  UpdateProfileAvatarDto,
  UpdateProfileDto,
  UpdateProfileSettingsDto,
} from '@tf2-automatic/dto';
import { EditProfileSettings, ProfileSetting } from 'steamcommunity';
import { BotService } from '../bot/bot.service';
import { ConfigService } from '@nestjs/config';
import { Config, SteamAccountConfig } from '../common/config/configuration';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ProfileService {
  private readonly community = this.botService.getCommunity();
  private readonly client = this.botService.getClient();

  constructor(
    private readonly botService: BotService,
    private readonly configService: ConfigService<Config>,
    private readonly storageService: StorageService,
  ) {}

  setAvatar(dto: UpdateProfileAvatarDto): Promise<void> {
    return new Promise((resolve, reject) => {
      this.community.uploadAvatar(dto.url, undefined, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  editProfile(dto: UpdateProfileDto): Promise<void> {
    return new Promise((resolve, reject) => {
      this.community.editProfile(dto as EditProfileSettings, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  editProfileSettings(dto: UpdateProfileSettingsDto): Promise<void> {
    return new Promise((resolve, reject) => {
      this.community.profileSettings(dto as ProfileSetting, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  deleteNameHistory(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.community.clearPersonaNameHistory((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  getTradeOfferUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.community.getTradeURL((err, url) => {
        if (err) {
          reject(err);
        } else {
          resolve(url);
        }
      });
    });
  }

  changeTradeOfferUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.community.changeTradeURL((err, url) => {
        if (err) {
          reject(err);
        } else {
          resolve(url);
        }
      });
    });
  }

  async setCustomGame(dto: UpdateCustomGameDto) {
    // Check the custom game file and play that if it exists, otherwise play only TF2
    const customGamePath = `customgame.${
      this.configService.getOrThrow<SteamAccountConfig>('steam').username
    }.txt`;

    const customGame = await this.storageService
      .write(customGamePath, dto.name)
      .catch(() => {
        return null;
      });

    if (!customGame) {
      // Error writing the custom game file, reject
      return Promise.reject();
    }

    return this.client.gamesPlayed([dto.name, 440]);
  }

  async clearCustomGame() {
    const customGamePath = `customgame.${
      this.configService.getOrThrow<SteamAccountConfig>('steam').username
    }.txt`;

    const customGame = await this.storageService
      .write(customGamePath, '')
      .catch(() => {
        return null;
      });

    if (!customGame) {
      // Error writing the custom game file, reject
      return Promise.reject();
    }

    return this.client.gamesPlayed([440]);
  }
}
