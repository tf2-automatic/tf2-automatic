import { Injectable, Logger } from '@nestjs/common';
import { OnModuleDestroy } from '@nestjs/common/interfaces';
import SteamUser from 'steam-user';
import SteamCommunity from 'steamcommunity';
import SteamTradeOfferManager from 'steam-tradeoffer-manager';
import SteamTotp from 'steam-totp';
import { Config, SteamAccountConfig } from '../common/config/configuration';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import SteamID from 'steamid';
import FileManager from 'file-manager';
import { EventsService } from '../events/events.service';
import { MetadataService } from '../metadata/metadata.service';

@Injectable()
export class BotService implements OnModuleDestroy {
  private logger = new Logger(BotService.name);

  private client: SteamUser = new SteamUser({
    autoRelogin: true,
    // Just needs to be set for custom storage to work
    dataDirectory: '',
  });
  private community: SteamCommunity = new SteamCommunity();
  private manager = new SteamTradeOfferManager({
    steam: this.client,
    community: this.community,
    language: 'en',
    dataDirectory: '',
    savePollData: true,
  });

  private _startPromise: Promise<void> | null = null;
  private lastWebLogin: Date | null = null;
  private running = false;

  constructor(
    private configService: ConfigService<Config>,
    private storageService: StorageService,
    private eventsService: EventsService,
    private metadataService: MetadataService
  ) {
    // Add type to manager storage
    const managerStorage = this.manager.storage as FileManager;
    managerStorage.on('read', (filename, callback) => {
      this.handleReadEvent(filename, callback);
    });

    managerStorage.on('save', (filename, contents, callback) => {
      this.handleWriteEvent(filename, contents, callback);
    });

    this.client.storage.on('read', (filename, callback) => {
      this.handleReadEvent(filename, callback);
    });

    this.client.storage.on('save', (filename, contents, callback) => {
      this.handleWriteEvent(filename, contents, callback);
    });

    this.client.on('loggedOn', () => {
      this.metadataService.setSteamID(this.client.steamID as SteamID);
      this.eventsService.publish('steam.connected');
    });

    this.client.on('disconnected', (eresult, msg) => {
      this.eventsService.publish('steam.disconnected', {
        eresult,
        msg,
      });
    });
  }

  isReady(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.running || this.client.steamID === null) {
        return false;
      }

      this.community.loggedIn((err, loggedIn) => {
        if (err) {
          return reject(err);
        }

        resolve(loggedIn);
      });
    });
  }

  getClient(): SteamUser {
    return this.client;
  }

  getManager(): SteamTradeOfferManager {
    return this.manager;
  }

  getCommunity(): SteamCommunity {
    return this.community;
  }

  private handleReadEvent(
    filename: string,
    callback: (err: Error | null, contents?: Buffer | null) => void
  ): void {
    this.storageService
      .read(filename)
      .then((contents) =>
        callback(null, contents ? Buffer.from(contents, 'utf8') : null)
      )
      .catch((err) => callback(err));
  }

  private handleWriteEvent(
    filename: string,
    contents: Buffer | string,
    callback: (err: Error | null) => void
  ): void {
    this.storageService
      .write(filename, contents.toString())
      .then(() => callback(null))
      .catch((err) => callback(err));
  }

  async start(): Promise<void> {
    if (this._startPromise) {
      // Already starting. Reuse existing promise
      return this._startPromise;
    } else if (this.running) {
      // Already started
      return;
    }

    this._startPromise = this._start().finally(() => {
      // Reset promise
      this._startPromise = null;
    });
    return this._startPromise;
  }

  private async _start(): Promise<void> {
    this.client.on('loginKey', (key) => {
      this.logger.debug('Received new login key');
      this.storageService.write('loginkey.txt', key).catch((err) => {
        this.logger.error(
          'Failed to write login key to storage: ' + err.message
        );
      });
    });

    this.community.on('sessionExpired', () => {
      this.logger.debug('Web session expired');
      this.webLogOn();
    });

    this.client.on('newItems', () => {
      this.logger.debug('Received new items');
      this.community.resetItemNotifications((err) => {
        if (err) {
          this.logger.error(
            'Failed to reset item notifications: ' + err.message
          );
        }
      });
    });

    this.manager.on('debug', (message: string) => {
      this.logger.debug(message);
    });

    const loginKey = await this.storageService.read('loginkey.txt');

    if (loginKey) {
      this.logger.debug('Found login key');
    }

    await this.login(loginKey ?? null);

    this.logger.log('Logged in to Steam!');
    this.logger.debug('SteamID: ' + this.getSteamID64());

    this.logger.log('Getting API key...');
    await this.waitForAPIKey();

    this.client.on('webSession', (_, cookies) => {
      this.logger.debug('Received web session');
      this.setCookies(cookies);
    });

    this.client.on('error', (err) => {
      this.logger.error(
        'Steam client error: ' + err.message + ' (eresult: ' + err.eresult + ')'
      );
    });

    this.running = true;

    this.logger.log('Bot is ready');

    return this.eventsService.publish('bot.ready');
  }

  private webLogOn(): void {
    this.logger.debug('webLogOn()');

    const now = new Date();
    if (
      this.lastWebLogin === null ||
      now.getTime() - 60000 > this.lastWebLogin.getTime()
    ) {
      // Last login was more than a minute ago, so we can log in again
      this.logger.verbose('Refreshing web session...');
      this.lastWebLogin = new Date();
      this.client.webLogOn();
    }
  }

  private async waitForAPIKey(): Promise<void> {
    if (this.manager.apiKey) {
      return;
    }

    const cookies = await this.waitForWebSession();
    await this.setCookies(cookies);
  }

  private setCookies(cookies: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.debug('Setting cookies');

      this.community.setCookies(cookies);
      this.manager.setCookies(cookies, (err: Error) => {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    });
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

  private waitForWebSession(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.client.removeListener('webSession', listener);
        reject(new Error('Timed out waiting for web session'));
      }, 10000);

      const listener = (_, cookies: string[]) => {
        clearTimeout(timeout);
        resolve(cookies);
      };

      this.client.once('webSession', listener);
    });
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
        clearTimeout(timeout);
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

      const timeout = setTimeout(() => {
        removeListeners();
        reject(new Error('Timed out waiting for logon'));
      }, 10000);

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

  async onModuleDestroy() {
    this.logger.debug('OnModuleDestroy()');
    return this.stop();
  }

  private async stop(): Promise<void> {
    this.logger.log('Stopping bot...');

    this.manager.shutdown();
    this.client.logOff();
    this.client.removeAllListeners();
    this.community.removeAllListeners();
    this.manager.removeAllListeners();

    this.running = false;

    this.logger.log('Bot has been stopped');
  }
}
