import { Injectable, OnModuleInit } from '@nestjs/common';
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
import SteamUser from 'steam-user';

@Injectable()
export class ProfileService implements OnModuleInit {
  private readonly community = this.botService.getCommunity();

  constructor(
    private readonly botService: BotService,
    private readonly configService: ConfigService<Config>,
    private readonly storageService: StorageService,
  ) {}

  async onModuleInit() {
    const [customGame, customPersonaState] = await Promise.all([
      this.getCustomGame(),
      this.getCustomPersonaState(),
    ]);

    this.botService.setCustomGame(customGame);
    this.botService.setCustomPersonaState(customPersonaState);
  }

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

  private getCustomGamePath() {
    return `customgame.${
      this.configService.getOrThrow<SteamAccountConfig>('steam').username
    }.txt`;
  }

  private getCustomPersonaStatePath() {
    return `persona.${
      this.configService.getOrThrow<SteamAccountConfig>('steam').username
    }.txt`;
  }

  setCustomGame(dto: UpdateCustomGameDto): Promise<void> {
    return this.saveCustomGame(dto.name);
  }

  clearCustomGame(): Promise<void> {
    return this.saveCustomGame(null);
  }

  private async saveCustomGame(name: string | null) {
    // Save the name, or empty string if null
    await this.storageService.write(this.getCustomGamePath(), name ?? '');
    this.botService.setCustomGame(name);
  }

  setCustomPersonaState(state: SteamUser.EPersonaState): Promise<void> {
    return this.saveCustomPersonaState(state);
  }

  clearCustomPersonaState(): Promise<void> {
    return this.saveCustomPersonaState(null);
  }

  private async saveCustomPersonaState(state: SteamUser.EPersonaState | null) {
    await this.storageService.write(
      this.getCustomPersonaStatePath(),
      state !== null ? state.toString() : '',
    );
    this.botService.setCustomPersonaState(state);
  }

  private async getCustomGame(): Promise<string | null> {
    const customGame = await this.storageService
      .read(this.getCustomGamePath())
      .catch(null);

    if (!customGame) {
      return null;
    }

    return customGame;
  }

  private async getCustomPersonaState(): Promise<SteamUser.EPersonaState | null> {
    const persona = await this.storageService
      .read(this.getCustomGamePath())
      .catch(null);

    if (persona === null || persona === '') {
      return null;
    }

    return parseInt(persona, 10);
  }
}
