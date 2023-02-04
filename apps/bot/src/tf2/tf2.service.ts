import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import TeamFortress2 from 'tf2';
import { Logger } from '@nestjs/common';
import { CraftRecipe } from '@tf2-automatic/bot-data';

@Injectable()
export class TF2Service implements OnApplicationShutdown {
  private readonly logger = new Logger(TF2Service.name);

  private readonly client = this.botService.getClient();
  private readonly tf2 = new TeamFortress2(this.client);

  private account: {
    isPremium: boolean;
    backpackSlots: number;
  } | null = null;

  constructor(private readonly botService: BotService) {
    this.client.on('loggedOn', () => {
      // Bot is logged in, connect to TF2 GC
      this.client.gamesPlayed([440]);
    });

    this.tf2.on('connectedToGC', () => {
      this.logger.debug('Connected to GC');
    });

    this.tf2.on('disconnectedFromGC', () => {
      this.logger.debug('Disconnected from GC');
    });

    this.tf2.on('accountLoaded', () => {
      this.logger.debug('Account loaded');
      this.accountLoaded();
    });

    this.tf2.on('accountUpdate', () => {
      this.logger.debug('Account update');
      this.accountLoaded();
    });
  }

  craft(assetids: string[], recipe: CraftRecipe): Promise<any> {
    this.tf2.craft(assetids, recipe);

    return this.waitForEvent('craftingComplete').then(([recipe, assetids]) => {
      return assetids;
    });
  }

  onApplicationShutdown(): void {
    this.client.gamesPlayed([]);
    this.tf2.removeAllListeners();
  }

  private accountLoaded(): void {
    this.account = {
      isPremium: this.tf2.premium,
      backpackSlots: this.tf2.backpackSlots,
    };
  }

  async connectToGC(): Promise<void> {
    if (!this.isPlayingTF2()) {
      // Not playing TF2
      this.client.gamesPlayed([440]);
    }

    if (this.tf2.haveGCSession) {
      // Already connected
      return;
    }

    await this.waitForEvent('connectedToGC');
  }

  isPlayingTF2(): boolean {
    // @ts-expect-error
    return (this.client._playingAppIds as number[]).some((game) => game == 440);
  }

  async getAccount(): Promise<{ isPremium: boolean; backpackSlots: number }> {
    if (this.account == null) {
      await this.connectToGC();
      await this.waitForEvent('accountLoaded').then(() => {
        this.accountLoaded();
      });
    }

    // This is magical
    return this.account as NonNullable<typeof this.account>;
  }

  private waitForEvent(eventName: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const listener = (...args) => {
        removeListeners();
        resolve(args);
      };

      const disconnectedListener = () => {
        removeListeners();
        reject(new Error('Disconnected from GC'));
      };

      const removeListeners = () => {
        clearTimeout(timeout);
        this.tf2.removeListener(eventName, listener);
        this.tf2.removeListener('disconnectedFromGC', disconnectedListener);
      };

      const timeout = setTimeout(() => {
        removeListeners();
        reject(new Error('Timed out waiting for event'));
      }, 10000);

      if (eventName !== 'disconnectedFromGC') {
        this.tf2.once('disconnectedFromGC', disconnectedListener);
      }

      this.tf2.once(eventName, listener);
    });
  }
}
