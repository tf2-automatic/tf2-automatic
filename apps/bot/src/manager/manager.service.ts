import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config, ManagerConfig } from '../common/config/configuration';
import { firstValueFrom } from 'rxjs';
import { OnEvent } from '@nestjs/event-emitter';
import { BotService } from '../bot/bot.service';
import ip from 'ip';
import {
  HEALTH_BASE_URL,
  HEALTH_PATH,
} from '@tf2-automatic/bot-manager-data';

@Injectable()
export class ManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ManagerService.name);

  private readonly enabled: boolean =
    this.configService.getOrThrow<ManagerConfig>('manager').enabled;

  private timeout: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly httpService: HttpService,
    private readonly botService: BotService
  ) {}

  private async sendHeartbeat(): Promise<void> {
    this.logger.debug('Sending heartbeat...');

    await firstValueFrom(
      this.httpService.post(
        `${
          this.configService.getOrThrow('manager').url
        }/heartbeats/${this.botService.getSteamID64()}`,
        {
          ip:
            this.configService.get<string>('ip') ??
            ip.address('private', 'ipv4'),
          // FIXME: Port is apparently a string in the config
          port: parseInt(this.configService.getOrThrow('port'), 10),
        }
      )
    );
  }

  private sendHeartbeatLoop() {
    return this.sendHeartbeat()
      .catch((err) => {
        this.logger.warn('Failed to send heartbeat: ' + err.message);
      })
      .finally(() => {
        this.timeout = setTimeout(
          () => this.sendHeartbeatLoop(),
          60 * 1000
        ).unref();
      });
  }

  private async deleteBot() {
    this.logger.debug('Removing bot...');

    await firstValueFrom(
      this.httpService.delete(
        `${
          this.configService.getOrThrow('manager').url
        }/heartbeats/${this.botService.getSteamID64()}`
      )
    );
  }

  private async isManagerRunning() {
    await firstValueFrom(
      this.httpService.get(
        `${
          this.configService.getOrThrow('manager').url
        }${HEALTH_BASE_URL}${HEALTH_PATH}`
      )
    );
  }

  @OnEvent('bot.ready')
  handleBotReady() {
    if (this.enabled) {
      this.sendHeartbeatLoop();
    }
  }

  onModuleInit(): Promise<void> {
    if (!this.enabled) {
      return Promise.resolve();
    }

    this.logger.log('Checking if bot manager is running...');

    return this.isManagerRunning()
      .then(() => {
        this.logger.debug('Bot manager is running');
      })
      .catch((err) => {
        throw new Error(
          'Failed to communicate with the bot manager: ' + err.message
        );
      });
  }

  onModuleDestroy(): Promise<void> {
    if (!this.enabled) {
      return Promise.resolve();
    }

    clearInterval(this.timeout);
    if (!this.botService.isRunning()) {
      return Promise.resolve();
    }

    return this.deleteBot();
  }
}
