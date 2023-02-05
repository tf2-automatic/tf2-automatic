import { Injectable } from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import SteamTradeOfferManager from 'steam-tradeoffer-manager';
import {
  GetTradesDto,
  GetTradesResponse,
  TradeOffer,
} from '@tf2-automatic/bot-data';

@Injectable()
export class TradesService {
  private readonly manager = this.botService.getManager();

  constructor(private readonly botService: BotService) {}

  getTrades(dto: GetTradesDto): Promise<GetTradesResponse> {
    return new Promise((resolve, reject) => {
      this.manager.getOffers(
        dto.filter,
        (
          err: Error,
          sent: SteamTradeOfferManager.TradeOffer[],
          received: SteamTradeOfferManager.TradeOffer[]
        ) => {
          if (err) {
            return reject(err);
          }

          const sentMapped = sent.map((offer) => {
            return this.mapOffer(offer);
          });
          const receivedMapped = received.map((offer) => {
            return this.mapOffer(offer);
          });

          return resolve({ sent: sentMapped, received: receivedMapped });
        }
      );
    });
  }

  private mapOffer(offer: SteamTradeOfferManager.TradeOffer): TradeOffer {
    return {
      partner: offer.partner.getSteamID64(),
      id: offer.id,
      message: offer.message,
      state: offer.state,
      itemsToGive: offer.itemsToGive,
      itemsToReceive: offer.itemsToReceive,
      isGlitched: offer.isGlitched(),
      isOurOffer: offer.isOurOffer,
      createdAt: Math.floor(offer.created.getTime() / 1000),
      updatedAt: Math.floor(offer.updated.getTime() / 1000),
      expiresAt: Math.floor(offer.expires.getTime() / 1000),
      tradeID: offer.tradeID,
      fromRealTimeTrade: offer.fromRealTimeTrade,
      confirmationMethod: offer.confirmationMethod,
      escrowEndsAt:
        offer.escrowEnds === null
          ? null
          : Math.floor(offer.escrowEnds.getTime() / 1000),
    };
  }
}
