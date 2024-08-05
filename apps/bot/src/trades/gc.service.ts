import { Injectable, Logger } from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import { ConfigService } from '@nestjs/config';
import { Config, SteamTradeConfig } from '../common/config/configuration';
import { TradeOfferData } from './types';
import TradeOffer from 'steam-tradeoffer-manager/lib/classes/TradeOffer';
import * as helpers from './helpers';

@Injectable()
export class GarbageCollectorService {
  private readonly logger: Logger = new Logger(GarbageCollectorService.name);

  private readonly manager = this.botService.getManager();

  private readonly rememberTime: number;

  constructor(
    private readonly botService: BotService,
    private readonly configService: ConfigService<Config>,
  ) {
    this.rememberTime =
      this.configService.getOrThrow<SteamTradeConfig>(
        'trade',
      ).pollDataForgetTime;
  }

  cleanup(sent: TradeOffer[], received: TradeOffer[]): void {
    // Compare poll data to the sent and received offers

    const missing: string[] = [];

    sent.forEach((offer) => {
      delete this.manager.pollData.offerData[offer.id!].missing;
    });

    received.forEach((offer) => {
      delete this.manager.pollData.offerData[offer.id!].missing;
    });

    for (const id in this.manager.pollData.sent) {
      if (!sent.some((offer) => offer.id === id)) {
        missing.push(id);
      }
    }

    for (const id in this.manager.pollData.received) {
      if (!received.some((offer) => offer.id === id)) {
        missing.push(id);
      }
    }

    const now = Date.now();
    let changed = false,
      removed = 0;

    const checkOffer = (id: string): void => {
      const offerData: TradeOfferData = this.manager.pollData.offerData[id];

      // Last published state is not completed
      const completed = helpers.isCompleted(offerData.published);
      if (!completed) {
        return;
      }

      if (!offerData.missing) {
        offerData.missing = now;
        changed = true;
      }

      if (offerData.missing + this.rememberTime > now) {
        return;
      }

      this.logger.debug(`Removing trade offer ${id}`);

      changed = true;
      removed++;

      // Remove offer data
      delete this.manager.pollData.sent[id];
      delete this.manager.pollData.received[id];
      delete this.manager.pollData.timestamps[id];
      delete this.manager.pollData.offerData[id];
    };

    missing.forEach(checkOffer);

    if (changed) {
      this.manager.emit('pollData', this.manager.pollData);
    }
  }
}
