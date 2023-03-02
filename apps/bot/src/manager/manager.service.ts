import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '../common/config/configuration';
import { firstValueFrom } from 'rxjs';
import { OnEvent } from '@nestjs/event-emitter';
import { BotService } from '../bot/bot.service';
import ip from 'ip';

@Injectable()
export class ManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(ManagerService.name);

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
        }/bots/${this.botService.getSteamID64()}/heartbeat`,
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

  private deleteBot() {
    this.logger.debug('Removing bot...');

    return firstValueFrom(
      this.httpService.delete(
        `${
          this.configService.getOrThrow('manager').url
        }/bots/${this.botService.getSteamID64()}`
      )
    );
  }

  @OnEvent('bot.ready')
  handleBotReady() {
    this.sendHeartbeatLoop();
  }

  onModuleDestroy() {
    clearInterval(this.timeout);
    if (!this.botService.isRunning()) {
      return;
    }

    return this.deleteBot();
  }
}
