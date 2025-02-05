import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  UpdateCustomGameDto,
  UpdateGamesDto,
  UpdateProfileAvatarDto,
  UpdateProfileDto,
  UpdateProfileSettingsDto,
} from '@tf2-automatic/dto';
import { EditProfileSettings, ProfileSetting } from 'steamcommunity';
import { BotService } from '../bot/bot.service';
import { ConfigService } from '@nestjs/config';
import { Config, SteamAccountConfig } from '../common/config/configuration';
import { NestStorageService } from '@tf2-automatic/nestjs-storage';
import SteamUser from 'steam-user';
import path from 'path';

const FILE_PATHS = {
  CUSTOM_GAME: (username: string) =>
    path.join(`bots/${username}`, 'customgame.txt'),
  GAMES: (username: string) => path.join(`bots/${username}`, 'games.txt'),
  PERSONA: (username: string) => path.join(`bots/${username}`, 'persona.txt'),
};

@Injectable()
export class ProfileService implements OnModuleInit {
  private readonly community = this.botService.getCommunity();

  private readonly username =
    this.configService.getOrThrow<SteamAccountConfig>('steam').username;

  constructor(
    private readonly botService: BotService,
    private readonly configService: ConfigService<Config>,
    private readonly storageService: NestStorageService,
  ) {}

  async onModuleInit() {
    const [customGame, games, customPersonaState] = await Promise.all([
      this.getCustomGame(),
      this.getGames(),
      this.getCustomPersonaState(),
    ]);

    this.botService.setCustomGame(customGame);
    this.botService.setGames(games);
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

  setCustomGame(dto: UpdateCustomGameDto): Promise<void> {
    return this.saveCustomGame(dto.name);
  }

  setGames(dto: UpdateGamesDto): Promise<void> {
    return this.saveGames(dto.appids);
  }

  clearCustomGame(): Promise<void> {
    return this.saveCustomGame(null);
  }

  private async saveCustomGame(name: string | null) {
    const filename = FILE_PATHS.CUSTOM_GAME(this.username);

    if (name === null) {
      await this.storageService.delete(filename);
    } else {
      await this.storageService.write(filename, name);
    }

    this.botService.setCustomGame(name);
  }

  private async saveGames(appids: number[]) {
    await this.storageService.write(
      FILE_PATHS.GAMES(this.username),
      appids.join(','),
    );
    this.botService.setGames(appids);
  }

  setCustomPersonaState(state: SteamUser.EPersonaState): Promise<void> {
    return this.saveCustomPersonaState(state);
  }

  clearCustomPersonaState(): Promise<void> {
    return this.saveCustomPersonaState(null);
  }

  private async saveCustomPersonaState(state: SteamUser.EPersonaState | null) {
    const filename = FILE_PATHS.PERSONA(this.username);

    if (state === null) {
      await this.storageService.delete(filename);
    } else {
      await this.storageService.write(filename, state.toString());
    }

    this.botService.setCustomPersonaState(state);
  }

  private async getCustomGame(): Promise<string | null> {
    const customGame = await this.storageService
      .read(FILE_PATHS.CUSTOM_GAME(this.username))
      .catch(null);

    if (!customGame) {
      return null;
    }

    return customGame;
  }

  private async getGames(): Promise<number[]> {
    const games = await this.storageService
      .read(FILE_PATHS.GAMES(this.username))
      .catch(null);

    if (!games) {
      const defaultGame =
        this.configService.getOrThrow<SteamAccountConfig>('steam').defaultGame;
      if (defaultGame) {
        return [defaultGame];
      }

      return [];
    }

    return games.split(',').map((game) => parseInt(game, 10));
  }

  private async getCustomPersonaState(): Promise<SteamUser.EPersonaState | null> {
    const persona = await this.storageService
      .read(FILE_PATHS.PERSONA(this.username))
      .catch(null);

    if (persona === null || persona === '') {
      return null;
    }

    return parseInt(persona, 10);
  }
}
