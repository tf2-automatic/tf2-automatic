import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config, ManagerConfig } from '../common/config/configuration';
import { firstValueFrom } from 'rxjs';
import { OnEvent } from '@nestjs/event-emitter';
import ip from 'ip';
import {
  BotHeartbeat,
  HEARTBEAT_BASE_URL,
  HEARTBEAT_PATH,
} from '@tf2-automatic/bot-manager-data';
import { MetadataService } from '../metadata/metadata.service';
import fs from 'fs';
import { AxiosError } from 'axios';

@Injectable()
export class ManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(ManagerService.name);

  private readonly managerConfig =
    this.configService.getOrThrow<ManagerConfig>('manager');

  private timeout: NodeJS.Timeout;
  private attempts = 0;

  private readonly ip: string;
  private readonly version: string | undefined;

  private ready = false;
  private beating = false;

  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly httpService: HttpService,
    private readonly metadataService: MetadataService,
  ) {
    const ourIp = this.configService.get<string>('ip');

    if (ourIp) {
      this.ip = ourIp;
    } else {
      this.ip = ip.address(
        process.env.NODE_ENV === 'development' ? 'private' : 'public',
        'ipv4',
      );
    }

    if (process.env.NODE_ENV === 'production') {
      this.version = JSON.parse(
        fs.readFileSync('package.json', 'utf8'),
      ).version;
    }
  }

  private async sendHeartbeat(): Promise<void> {
    this.logger.debug('Sending heartbeat...');

    const heartbeat: BotHeartbeat = {
      ip: this.ip,
      // FIXME: Port is apparently a string in the config
      port: parseInt(this.configService.getOrThrow('port'), 10),
      interval: this.managerConfig.heartbeatInterval as number,
      version: this.version,
    };

    await firstValueFrom(
      this.httpService.post(
        `${this.managerConfig.url}${HEARTBEAT_BASE_URL}${HEARTBEAT_PATH}`.replace(
          ':steamid',
          this.metadataService.getOrThrowSteamID().getSteamID64(),
        ),
        heartbeat,
      ),
    );
  }

  private sendHeartbeatLoop() {
    if (!this.managerConfig.enabled) {
      return;
    }

    this.beating = true;

    return this.sendHeartbeat()
      .then(() => {
        this.attempts = 0;
      })
      .catch((err) => {
        this.logger.warn('Failed to send heartbeat: ' + err.message);
        this.attempts++;
      })
      .finally(() => {
        const interval = this.managerConfig.heartbeatInterval as number;

        let wait =
          this.attempts > 0 ? 2 ** (this.attempts - 1) * 1000 : interval;

        if (wait > interval) {
          // Don't wait longer than the interval
          wait = interval;
        }

        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.sendHeartbeatLoop(), wait).unref();
      });
  }

  private async deleteBot() {
    const steamid = this.metadataService.getSteamID();
    if (!steamid) {
      return;
    }

    this.logger.debug('Removing bot...');

    await firstValueFrom(
      this.httpService.delete(
        `${this.managerConfig.url}${HEARTBEAT_BASE_URL}${HEARTBEAT_PATH}`.replace(
          ':steamid',
          this.metadataService.getOrThrowSteamID().getSteamID64(),
        ),
      ),
    ).catch((err) => {
      if (err instanceof AxiosError && err.response?.status === 404) {
        return;
      }

      throw err;
    });
  }

  @OnEvent('bot.ready')
  handleBotReady() {
    this.ready = true;
    if (!this.beating) {
      this.sendHeartbeatLoop();
    }
  }

  @OnEvent('bot.disconnected')
  handleBotDisconnected() {
    this.stopHeartbeatLoop();
  }

  @OnEvent('bot.connected')
  handleBotConnected() {
    if (this.ready && !this.beating) {
      this.sendHeartbeatLoop();
    }
  }

  onModuleDestroy(): Promise<void> {
    return this.stopHeartbeatLoop();
  }

  private stopHeartbeatLoop() {
    clearInterval(this.timeout);
    this.beating = false;

    if (!this.managerConfig.enabled) {
      return Promise.resolve();
    }

    return this.deleteBot().catch((err) => {
      this.logger.warn('Failed to remove bot: ' + err.message);
    });
  }
}
