import { Injectable, Logger } from '@nestjs/common';
import { OnModuleDestroy } from '@nestjs/common/interfaces';
import SteamUser from 'steam-user';
import SteamCommunity from 'steamcommunity';
import SteamTradeOfferManager from 'steam-tradeoffer-manager';
import SteamTotp from 'steam-totp';
import {
  Config,
  SteamAccountConfig,
  SteamTradeConfig,
} from '../common/config/configuration';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import SteamID from 'steamid';
import { EventsService } from '../events/events.service';
import { MetadataService } from '../metadata/metadata.service';
import {
  BotReadyEvent,
  BOT_READY_EVENT,
  SteamConnectedEvent,
  SteamDisconnectedEvent,
  STEAM_CONNECTED_EVENT,
  STEAM_DISCONNECTED_EVENT,
  Bot,
} from '@tf2-automatic/bot-data';
import request from 'request';
import { ShutdownService } from '../shutdown/shutdown.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Summary, register } from 'prom-client';
import jwt from 'jsonwebtoken';
import objectHash from 'object-hash';

type HistogramEndCallback = (labels?: unknown) => void;

@Injectable()
export class BotService implements OnModuleDestroy {
  private logger = new Logger(BotService.name);

  private client: SteamUser = new SteamUser({
    autoRelogin: false,
    // Just needs to be set for custom storage to work
    dataDirectory: '',
    httpProxy:
      this.configService.getOrThrow<SteamAccountConfig>('steam').proxyUrl,
  });
  private community: SteamCommunity = new SteamCommunity({
    request: request.defaults({
      proxy:
        this.configService.getOrThrow<SteamAccountConfig>('steam').proxyUrl,
    }),
    timeout: 10000,
  });
  private manager: SteamTradeOfferManager;
  private pollInterval: number;
  private customGamePlayed: string | null = null;

  private _startPromise: Promise<void> | null = null;
  private _reconnectPromise: Promise<void> | null = null;
  private lastWebLogin: Date | null = null;
  private running = false;

  private histogramEnds: Map<string, HistogramEndCallback> = new Map();

  constructor(
    private shutdownService: ShutdownService,
    private configService: ConfigService<Config>,
    private storageService: StorageService,
    private eventsService: EventsService,
    private metadataService: MetadataService,
    private eventEmitter: EventEmitter2,
    @InjectMetric('steam_api_request_duration_seconds')
    private readonly steamApiRequestDuration: Summary,
  ) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.community.onPreHttpRequest = (
      requestID,
      _,
      options,
      continueRequest,
    ) => {
      const url = new URL(options.url);
      url.search = '';
      url.hash = '';

      this.histogramEnds.set(
        requestID,
        this.steamApiRequestDuration.startTimer({
          method: options.method ?? 'GET',
          url: url.toString().replace(/\/\d+/g, '/:number'),
        }),
      );
      continueRequest();
    };

    this.community.on('postHttpRequest', (requestID, _, __, ___, response) => {
      this.histogramEnds.get(requestID)?.({
        status: response?.statusCode ?? null,
      });
    });

    const tradeConfig =
      this.configService.getOrThrow<SteamTradeConfig>('trade');

    this.manager = new SteamTradeOfferManager({
      steam: this.client,
      community: this.community,
      language: 'en',
      dataDirectory: '',
      savePollData: true,
      pollInterval: tradeConfig.pollInterval,
      pendingCancelTime: tradeConfig.pendingCancelTime,
      cancelTime: tradeConfig.cancelTime,
    });

    this.pollInterval = this.manager.pollInterval;

    this.manager.storage.on('read', (filename, callback) => {
      this.handleReadEvent(filename, callback);
    });

    this.manager.storage.on('save', (filename, contents, callback) => {
      this.handleWriteEvent(filename, contents, callback);
    });

    this.client.storage.on('read', (filename, callback) => {
      this.handleReadEvent(filename, callback);
    });

    this.client.storage.on('save', (filename, contents, callback) => {
      this.handleWriteEvent(filename, contents, callback);
    });

    this.client.on('loggedOn', () => {
      this.logger.log('Logged in to Steam!');

      this.setGamePlayed(440);

      if (this.running) {
        this.client.setPersona(SteamUser.EPersonaState.Online);
      }

      this.metadataService.setSteamID(this.client.steamID as SteamID);

      this.eventEmitter.emit('bot.connected');

      this.eventsService
        .publish(
          STEAM_CONNECTED_EVENT,
          {} satisfies SteamConnectedEvent['data'],
        )
        .catch(() => {
          // Ignore error
        });
    });

    this.client.on('disconnected', (eresult, msg) => {
      this.logger.warn(
        `Disconnected from Steam, eresult: ${SteamUser.EResult[eresult]} (${eresult})`,
      );

      // Disable polling
      this.manager.pollInterval = -1;

      this.eventEmitter.emit('bot.disconnected');

      this.eventsService
        .publish(STEAM_DISCONNECTED_EVENT, {
          eresult,
          msg,
        } satisfies SteamDisconnectedEvent['data'])
        .catch(() => {
          // Ignore error
        });
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.client.on('refreshToken', (token: string) => {
      const tokenPath = `token.${
        this.configService.getOrThrow<SteamAccountConfig>('steam').username
      }.txt`;

      this.storageService.write(tokenPath, token).catch((err) => {
        this.logger.warn('Failed to save refresh token: ' + err.message);
      });
    });
  }

  getBot(): Bot {
    return {
      steamid64: this.getSteamID64(),
      apiKey: this.getApiKey(),
    };
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

  isRunning(): boolean {
    return this.running;
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

  leaveGames(): void {
    this.client.gamesPlayed([]);
  }

  setGamePlayed(appid: number | null) {
    const gamesPlayed: (string | number)[] = [];

    if (this.customGamePlayed) {
      gamesPlayed.push(this.customGamePlayed);
    }

    if (appid) {
      gamesPlayed.push(appid);
    }

    this.client.gamesPlayed(gamesPlayed);
  }

  setCustomGame(gameName: string | null) {
    if (gameName === this.customGamePlayed) {
      return;
    }

    this.customGamePlayed = gameName;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error _playingAppIds is private
    const gamesPlayed: number[] = this.client._playingAppIds;

    this.setGamePlayed(gamesPlayed.length > 0 ? gamesPlayed[0] : null);
  }

  private handleReadEvent(
    filename: string,
    callback: (err: Error | null, contents?: Buffer | null) => void,
  ): void {
    this.storageService
      .read(filename)
      .then((contents) =>
        callback(null, contents ? Buffer.from(contents, 'utf8') : null),
      )
      .catch((err) => callback(err));
  }

  private handleWriteEvent(
    filename: string,
    contents: Buffer | string,
    callback: (err: Error | null) => void,
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

  private async getCustomGame(): Promise<string | null> {
    if (this.customGamePlayed) {
      return this.customGamePlayed;
    }

    const customGamePath = `customgame.${
      this.configService.getOrThrow<SteamAccountConfig>('steam').username
    }.txt`;

    const customGame = await this.storageService
      .read(customGamePath)
      .catch(null);

    if (customGame) {
      this.customGamePlayed = customGame;
    }

    return this.customGamePlayed;
  }

  private async getDisabled(): Promise<string | false> {
    const steamDetails =
      this.configService.getOrThrow<SteamAccountConfig>('steam');

    // Check for file to prevent logging in on fatal error
    const path = `disabled.${steamDetails.username}.txt`;

    const result = await this.storageService.read(path);
    if (result === null) {
      return false;
    }

    try {
      const data = JSON.parse(result) as { reason: string; hash: string };
      if (data.hash === objectHash(steamDetails)) {
        return data.reason;
      }
    } catch {
      return false;
    }

    return false;
  }

  private async setDisabled(reason: string | null): Promise<void> {
    this.logger.warn('Disabling bot, reason: ' + reason);

    const steamDetails =
      this.configService.getOrThrow<SteamAccountConfig>('steam');

    const path = `disabled.${steamDetails.username}.txt`;

    if (reason === null) {
      // TODO: Delete file
      await this.storageService.write(path, '');
    } else {
      const data = {
        reason,
        hash: objectHash(steamDetails),
      };

      await this.storageService.write(path, JSON.stringify(data));
    }
  }

  private async _start(): Promise<void> {
    const disabled = await this.getDisabled();
    if (disabled !== false) {
      throw new Error('Bot is disabled, reason: ' + disabled);
    }

    this.community.on('sessionExpired', () => {
      this.logger.debug('Web session expired');
      this.webLogOn();
    });

    this.client.on('newItems', () => {
      this.logger.debug('Received new items');
      this.community.resetItemNotifications((err) => {
        if (err) {
          this.logger.error(
            'Failed to reset item notifications: ' + err.message,
          );
        }
      });
    });

    this.manager.on('debug', (message: string) => {
      this.logger.debug(message);
    });

    await this.getCustomGame();

    await this.reconnect();

    this.logger.debug('SteamID: ' + this.getSteamID64());

    this.logger.log('Getting API key...');
    await this.waitForAPIKey();

    this.client.on('webSession', (_, cookies) => {
      this.logger.debug('Received web session');
      this.setCookies(cookies);
    });

    this.client.on('error', (err) => {
      this.logger.error(
        'Steam client error: ' +
          err.message +
          ' (eresult: ' +
          err.eresult +
          ')',
      );

      this.eventEmitter.emit('bot.disconnected');

      this.eventsService
        .publish(STEAM_DISCONNECTED_EVENT, {
          eresult: err.eresult,
        } satisfies SteamDisconnectedEvent['data'])
        .catch(() => {
          // Ignore error
        });

      this.reconnect().catch((err) => {
        this.logger.warn('Failed to reconnect: ' + err.message);
        this.shutdownService.shutdown();
      });
    });

    this.running = true;

    this.logger.log('Bot is ready');

    this.client.setPersona(SteamUser.EPersonaState.Online);

    register.setDefaultLabels({
      steamid64: this.getSteamID64(),
    });

    return this.eventsService
      .publish(BOT_READY_EVENT, {} satisfies BotReadyEvent['data'])
      .then(() => {
        this.eventEmitter.emit('bot.ready');
      });
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

  getApiKey(): string {
    if (!this.manager.apiKey) {
      throw new Error('Not logged in');
    }

    return this.manager.apiKey;
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

  private async login(refreshToken?: string): Promise<void> {
    this.logger.log('Logging in to Steam...');

    return new Promise<void>((resolve, reject) => {
      if (this.client.steamID !== null) {
        this.logger.warn('Already logged in');
        return resolve();
      }

      this.client.removeAllListeners('steamGuard');

      const accountConfig =
        this.configService.getOrThrow<SteamAccountConfig>('steam');

      let steamGuardAttempts = 0;

      this.client.on('steamGuard', (domain, callback) => {
        steamGuardAttempts++;

        if (steamGuardAttempts > 2) {
          removeListeners();
          return reject(new Error('Too many Steam Guard attempts'));
        }

        this.logger.debug(
          'Steam guard code requested (domain: ' + domain + ')',
        );
        callback(SteamTotp.generateAuthCode(accountConfig.sharedSecret));
      });

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
        return reject(err);
      };

      const timeout = setTimeout(() => {
        removeListeners();
        this.client.logOff();
        reject(new Error('Timed out waiting for logon'));
      }, 10000);

      const login = () => {
        let loginDetails:
          | { refreshToken: string }
          | { accountName: string; password: string };

        // Add listeners
        this.client.once('loggedOn', loggedOnListener);
        this.client.once('error', errorListener);

        if (refreshToken) {
          this.logger.debug(
            'Attempting to login to Steam with refresh token...',
          );
          loginDetails = { refreshToken };
        } else {
          this.logger.debug('Attempting to login to Steam...');
          loginDetails = {
            accountName: accountConfig.username,
            password: accountConfig.password,
          };
        }

        this.client.logOn(loginDetails);
      };

      login();
    });
  }

  private async reconnect() {
    if (!this._reconnectPromise) {
      // Disable polling
      this.manager.pollInterval = -1;

      this._reconnectPromise = this.retryLogin()
        .then(() => {
          // Re-enable polling
          this.manager.pollInterval = this.pollInterval;
          this.manager.doPoll();
        })
        .finally(() => {
          // Reset promise
          this._reconnectPromise = null;
        });
    }

    return this._reconnectPromise;
  }

  private async retryLogin() {
    let attempts = 0;
    let attemptsRatelimited = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempts++;

      this.logger.debug(
        'Attempting to connect to Steam (attempt ' + attempts + ')...',
      );

      const refreshToken = await this.getRefreshToken();

      try {
        await this.login(refreshToken || undefined);
        break;
      } catch (err) {
        if (err.message === 'Too many Steam Guard attempts') {
          await this.setDisabled('Wrong shared secret');
          throw err;
        } else if (err.eresult === SteamUser.EResult.InvalidPassword) {
          await this.setDisabled('Wrong username and/or password');
          throw err;
        } else if (err.eresult === SteamUser.EResult.InvalidPassword) {
          throw err;
        } else if (err.eresult === SteamUser.EResult.AccessDenied) {
          // Refresh token is invalid
          await this.deleteRefreshToken().catch(() => {
            // Ignore error
          });
        }

        if (err.eresult === SteamUser.EResult.RateLimitExceeded) {
          attemptsRatelimited++;
        } else {
          attemptsRatelimited = 0;
        }

        const delay =
          attemptsRatelimited > 0
            ? this.calculateBackoff(5 * 60 * 1000, attemptsRatelimited)
            : this.calculateBackoff(10000, attempts);

        this.logger.warn(
          'Failed to connect: ' +
            err.message +
            ' (retrying in ' +
            delay +
            'ms)',
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private calculateBackoff(delay: number, attempts: number): number {
    return delay * Math.pow(2, attempts - 1) + Math.floor(Math.random() * 1000);
  }

  private async getRefreshToken(): Promise<string | null> {
    const tokenPath = `token.${
      this.configService.getOrThrow<SteamAccountConfig>('steam').username
    }.txt`;

    const refreshToken = await this.storageService
      .read(tokenPath)
      .catch(() => null);

    if (!refreshToken) {
      return null;
    }

    const decoded = jwt.decode(refreshToken, {
      complete: true,
    });

    if (!decoded) {
      // Invalid token
      return null;
    }

    const { exp } = decoded.payload as { exp: number };

    if (exp < Date.now() / 1000) {
      // Refresh token expired
      return null;
    }

    return refreshToken;
  }

  private async deleteRefreshToken(): Promise<void> {
    const tokenPath = `token.${
      this.configService.getOrThrow<SteamAccountConfig>('steam').username
    }.txt`;

    await this.storageService.write(tokenPath, '').catch(() => {
      // Ignore error
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
