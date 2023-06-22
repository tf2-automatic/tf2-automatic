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

@Injectable()
export class ManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(ManagerService.name);

  private readonly managerConfig =
    this.configService.getOrThrow<ManagerConfig>('manager');

  private timeout: NodeJS.Timeout;

  private readonly ip: string;

  private ready = false;

  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly httpService: HttpService,
    private readonly metadataService: MetadataService
  ) {
    const ourIp = this.configService.get<string>('ip');

    if (ourIp) {
      this.ip = ourIp;
    } else {
      this.ip = ip.address(
        process.env.NODE_ENV === 'development' ? 'private' : 'public',
        'ipv4'
      );
    }
  }

  private async sendHeartbeat(): Promise<void> {
    this.logger.debug('Sending heartbeat...');

    const heartbeat: BotHeartbeat = {
      ip: this.ip,
      // FIXME: Port is apparently a string in the config
      port: parseInt(this.configService.getOrThrow('port'), 10),
      interval: this.managerConfig.heartbeatInterval as number,
    };

    await firstValueFrom(
      this.httpService.post(
        `${this.managerConfig.url}${HEARTBEAT_BASE_URL}${HEARTBEAT_PATH}`.replace(
          ':steamid',
          this.metadataService.getOrThrowSteamID().getSteamID64()
        ),
        heartbeat
      )
    );
  }

  private sendHeartbeatLoop() {
    if (!this.managerConfig.enabled) {
      return;
    }

    return this.sendHeartbeat()
      .catch((err) => {
        this.logger.warn('Failed to send heartbeat: ' + err.message);
      })
      .finally(() => {
        this.timeout = setTimeout(
          () => this.sendHeartbeatLoop(),
          this.managerConfig.heartbeatInterval
        ).unref();
      });
  }

  private async deleteBot() {
    this.logger.debug('Removing bot...');

    await firstValueFrom(
      this.httpService.delete(
        `${this.managerConfig.url}${HEARTBEAT_BASE_URL}${HEARTBEAT_PATH}`.replace(
          ':steamid',
          this.metadataService.getOrThrowSteamID().getSteamID64()
        )
      )
    );
  }

  @OnEvent('bot.ready')
  handleBotReady() {
    this.ready = true;
    this.sendHeartbeatLoop();
  }

  @OnEvent('bot.disconnected')
  handleBotDisconnected() {
    this.stopHeartbeatLoop();
  }

  @OnEvent('bot.connected')
  handleBotConnected() {
    if (this.ready) {
      this.sendHeartbeatLoop();
    }
  }

  onModuleDestroy(): Promise<void> {
    return this.stopHeartbeatLoop();
  }

  private stopHeartbeatLoop() {
    if (!this.managerConfig.enabled) {
      return Promise.resolve();
    }

    clearInterval(this.timeout);
    return this.deleteBot().catch((err) => {
      this.logger.warn('Failed to remove bot: ' + err.message);
    });
  }
}
