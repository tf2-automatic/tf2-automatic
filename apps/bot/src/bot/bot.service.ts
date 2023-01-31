import { Injectable, Logger } from '@nestjs/common';
import {
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common/interfaces';
import SteamUser from 'steam-user';
import SteamCommunity from 'steamcommunity';
import SteamTradeOfferManager from 'steam-tradeoffer-manager';
import SteamTotp from 'steam-totp';
import { Config, SteamAccountConfig } from '../common/config/configuration';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import SteamID from 'steamid';

@Injectable()
export class BotService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private logger = new Logger(BotService.name);

  private client: SteamUser = new SteamUser();
  private community: SteamCommunity = new SteamCommunity();
  private manager = new SteamTradeOfferManager({
    steam: this.client,
    community: this.community,
    language: 'en',
  });

  constructor(
    private configService: ConfigService<Config>,
    private storageService: StorageService
  ) {}

  async onApplicationBootstrap() {
    this.logger.debug('onApplicationBootstrap()');

    this.client.on('loginKey', (key) => {
      this.logger.debug('Received new login key');
      this.storageService.write('loginkey.txt', key).catch((err) => {
        this.logger.error(
          'Failed to write login key to storage: ' + err.message
        );
        this.logger.debug(err);
      });
    });

    const loginKey = await this.storageService.read('loginkey.txt');

    if (loginKey) {
      this.logger.debug('Found login key');
    }

    try {
      await this.login(loginKey ?? null);
    } catch (err) {
      this.logger.error(
        'Failed to log in to Steam: ' +
          err.message +
          ' (eresult: ' +
          err.eresult +
          ')'
      );
      this.logger.debug(err);
      process.exit(1);
    }

    this.logger.log('Logged in to Steam!');
    this.logger.debug('SteamID: ' + this.getSteamID64());
  }

  private getSteamID(): SteamID {
    if (!this.client.steamID) {
      throw new Error('Not logged in');
    }

    return this.client.steamID;
  }

  getSteamID64(): string {
    return this.getSteamID().getSteamID64();
  }

  private login(loginKey: string | null = null): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.log('Logging in to Steam...');

      this.client.removeAllListeners('steamGuard');

      const accountConfig =
        this.configService.getOrThrow<SteamAccountConfig>('steam');

      this.client.on('steamGuard', (domain, callback) => {
        this.logger.debug(
          'Steam guard code requested (domain: ' + domain + ')'
        );
        callback(SteamTotp.generateAuthCode(accountConfig.sharedSecret));
      });

      // If we have a login key, we'll try to use it first
      let usingLoginKey = loginKey !== null;

      const removeListeners = () => {
        this.client.removeListener('loggedOn', loggedOnListener);
        this.client.removeListener('error', errorListener);
      };

      // Create logon and error listeners
      const loggedOnListener = () => {
        removeListeners();
        resolve();
      };

      const errorListener = (err: Error & { eresult: SteamUser.EResult }) => {
        removeListeners();

        if (
          err.eresult === SteamUser.EResult.InvalidPassword &&
          usingLoginKey
        ) {
          // Invalid login key. Try again using password
          usingLoginKey = false;
          this.logger.warn(
            'Login using login key failed. Trying again using password...'
          );
          return login();
        }

        // Some other error
        return reject(err);
      };

      const login = () => {
        this.logger.debug(
          'Attempting to log in using ' +
            (usingLoginKey ? 'login key' : 'password')
        );

        const loginDetails = {
          accountName: accountConfig.username,
          rememberPassword: true,
        };

        if (usingLoginKey) {
          loginDetails['loginKey'] = loginKey;
        } else {
          loginDetails['password'] = accountConfig.password;
        }

        // Add listeners
        this.client.once('loggedOn', loggedOnListener);
        this.client.once('error', errorListener);

        this.client.logOn(loginDetails);
      };

      login();
    });
  }

  async onApplicationShutdown() {
    this.logger.debug('onApplicationShutdown()');
    this.manager.shutdown();
    this.client.logOff();
    this.client.removeAllListeners();
  }
}
