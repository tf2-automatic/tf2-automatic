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
import promiseRetry from 'promise-retry';
import { ShutdownService } from '../shutdown/shutdown.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Summary, register } from 'prom-client';
import {
  LoginSession,
  EAuthTokenPlatformType,
  EAuthSessionGuardType,
} from 'steam-session';
import jwt from 'jsonwebtoken';

interface SteamTokens {
  refreshToken: string;
  accessToken: string;
}

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
  private session: LoginSession | null = null;
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

  private async _start(): Promise<void> {
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

  private async startSession(): Promise<string> {
    this.session = new LoginSession(EAuthTokenPlatformType.SteamClient, {
      httpProxy:
        this.configService.getOrThrow<SteamAccountConfig>('steam').proxyUrl,
    });

    this.session.on('debug', (message) => {
      this.logger.debug('Session debug: ' + message);
    });

    const tokensPath = `tokens.${
      this.configService.getOrThrow<SteamAccountConfig>('steam').username
    }.json`;

    const oldTokens = await this.storageService
      .read(tokensPath)
      .catch((err) => {
        this.logger.warn('Failed to read tokens: ' + err.message);
        return null;
      });

    if (oldTokens !== null) {
      this.logger.debug('Found old tokens');

      // Figure out if the refresh token expired
      const { refreshToken, accessToken } = JSON.parse(
        oldTokens,
      ) satisfies SteamTokens;

      this.session.refreshToken = refreshToken;
      this.session.accessToken = accessToken;

      const decoded = jwt.decode(refreshToken, {
        complete: true,
      });

      if (decoded) {
        const { exp } = decoded.payload as { exp: number };

        if (exp < Date.now() / 1000) {
          // Refresh token expired, log in again
          this.logger.debug('Refresh token expired, logging in again');
        } else {
          // Refresh token is still valid, use it
          return refreshToken;
        }
      }
    }

    const accountConfig =
      this.configService.getOrThrow<SteamAccountConfig>('steam');

    const result = await this.session.startWithCredentials({
      accountName: accountConfig.username,
      password: accountConfig.password,
    });

    if (result.actionRequired) {
      const actions = result.validActions ?? [];

      if (actions.length !== 1) {
        throw new Error(
          'Unexpected number of valid actions: ' + actions.length,
        );
      }

      const action = actions[0];

      if (action.type !== EAuthSessionGuardType.DeviceCode) {
        throw new Error('Unexpected action type: ' + action.type);
      }

      await this.session.submitSteamGuardCode(
        SteamTotp.generateAuthCode(accountConfig.sharedSecret),
      );
    }

    this.session.on('error', (err) => {
      this.logger.warn('Error in session: ' + err.message);
    });

    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    return new Promise<void>((resolve, reject) => {
      const handleAuth = () => {
        this.logger.debug('Session authenticated');
        removeListeners();
        resolve();
      };

      const handleTimeout = () => {
        removeListeners();
        reject(new Error('Login session timed out'));
      };

      const handleError = (err: Error) => {
        removeListeners();
        reject(err);
      };

      const removeListeners = () => {
        this.session!.removeListener('authenticated', handleAuth);
        this.session!.removeListener('timeout', handleTimeout);
        this.session!.removeListener('error', handleError);
      };

      this.session!.once('authenticated', handleAuth);
      this.session!.once('error', handleError);
    }).then(() => {
      this.metadataService.setSteamID(this.session!.steamID);

      const refreshToken = this.session!.refreshToken;

      this.storageService
        .write(
          tokensPath,
          JSON.stringify({
            refreshToken,
            accessToken: this.session!.accessToken,
          } satisfies SteamTokens),
        )
        .catch((err) => {
          this.logger.warn('Failed to save refresh token: ' + err.message);
        });

      this.session!.removeAllListeners();
      this.session = null;

      return refreshToken;
    });
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
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

  private async login(): Promise<void> {
    this.logger.log('Logging in to Steam...');

    const refreshToken = await this.startSession();

    return new Promise<void>((resolve, reject) => {
      if (this.client.steamID !== null) {
        this.logger.warn('Already logged in');
        return resolve();
      }

      this.client.removeAllListeners('steamGuard');

      const accountConfig =
        this.configService.getOrThrow<SteamAccountConfig>('steam');

      this.client.on('steamGuard', (domain, callback) => {
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
        reject(new Error('Timed out waiting for logon'));
      }, 10000);

      const login = () => {
        this.logger.debug('Attempting to login to Steam...');

        const loginDetails = {
          refreshToken,
        };

        // Add listeners
        this.client.once('loggedOn', loggedOnListener);
        this.client.once('error', errorListener);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.client.logOn(loginDetails);
      };

      login();
    });
  }

  private reconnect() {
    if (!this._reconnectPromise) {
      const pollInterval = this.manager.pollInterval;

      // Disable polling
      this.manager.pollInterval = -1;

      const promise = new Promise<void>((resolve) => {
        // Wait a second before reconnecting to avoid retrying too quickly
        setTimeout(() => {
          resolve();
        }, 1000);
      }).then(() => {
        return promiseRetry(
          (retry, attempt) => {
            this.logger.debug(
              'Attempting to connect to Steam (attempt ' + attempt + ')...',
            );
            return this.login().catch((err) => {
              this.logger.warn('Failed to connect: ' + err.message);
              retry(err);
            });
          },
          {
            forever: true,
            maxTimeout: 1000 * 60 * 60 * 2,
            minTimeout: 10000,
            randomize: true,
          },
        );
      });

      this._reconnectPromise = promise
        .then(() => {
          // Re-enable polling
          this.manager.pollInterval = pollInterval;
          this.manager.doPoll();
        })
        .finally(() => {
          // Reset promise
          this._reconnectPromise = null;
        });
    }

    return this._reconnectPromise;
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
    if (this.session) {
      this.session.removeAllListeners();
      this.session.cancelLoginAttempt();
    }

    this.running = false;

    this.logger.log('Bot has been stopped');
  }
}
