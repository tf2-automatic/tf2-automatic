import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import SteamID from 'steamid';
import { FriendsService } from '../friends/friends.service';
import { TradesService } from '../trades/trades.service';
import TradeOffer from 'steam-tradeoffer-manager/lib/classes/TradeOffer';
import TradeOfferManager from 'steam-tradeoffer-manager';

type TradeOfferWithEscrow = TradeOffer & {
  escrowEnds?: Date | null;
  rawJson?: string;
  _token?: string | null;
};
type TradeHoldDuration = {
  escrow_end_duration_seconds?: number;
  escrow_end_date?: number;
};
type TradeHoldDurationsResponse = {
  response?: {
    my_escrow?: TradeHoldDuration;
    their_escrow?: TradeHoldDuration;
    both_escrow?: TradeHoldDuration;
  };
};
type TradeOfferManagerWithApiCall = TradeOfferManager & {
  _apiCall(
    httpMethod: 'GET' | 'POST',
    method: string,
    version: number,
    input: object,
    callback: (err: Error | null, body?: TradeHoldDurationsResponse) => void,
  ): void;
};

const SECONDS_PER_DAY = 86400;

@Injectable()
export class EscrowService {
  private readonly manager = this.botService.getManager();
  logger = new Logger(this.constructor.name);

  constructor(
    private readonly botService: BotService,
    private readonly friendsService: FriendsService,
    private readonly tradesService: TradesService,
  ) {}

  private async getOffer(steamid: SteamID, token?: string, offerId?: string) {
    if (offerId) {
      const offer = await this.tradesService.getActualOffer(offerId);
      if (offer.isOurOffer) {
        throw new BadRequestException('Offer was made by us');
      }

      if (offer.partner.getSteamID64() !== steamid.getSteamID64()) {
        throw new BadRequestException(
          'Partner steamid does not match provided steamid',
        );
      }
      return offer;
    }

    if (!token) {
      const isFriend = await this.friendsService.isFriend(steamid);
      if (!isFriend) {
        throw new BadRequestException(
          'Token is required when not friends with the user',
        );
      }
    }

    return this.manager.createOffer(steamid, token);
  }

  async getEscrowDuration(
    steamid: SteamID,
    token?: string,
    offerId?: string,
  ): Promise<number> {
    const offer = await this.getOffer(steamid, token, offerId);
    return this.getEscrowDaysWithWebApi(offer).catch((err) => {
      this.logger.warn(
        'Failed to check escrow with WebAPI, falling back to SteamCommunity HTML',
        err,
      );
      return this.getEscrowDaysWithHtml(offer);
    });
  }

  private getEscrowDaysWithWebApi(offer: TradeOffer): Promise<number> {
    const escrowEnds = this.getEscrowEndsFromOffer(offer);

    if (escrowEnds !== undefined) {
      this.logger.debug('Done checking escrow with offer WebAPI data');
      return Promise.resolve(this.daysUntil(escrowEnds));
    }

    if (!offer.id) {
      return this.getEscrowDaysWithTradeHoldDurations(offer);
    }

    throw new Error(
      `WebAPI response for offer #${offer.id} did not include escrow_end_date`,
    );
  }

  private getEscrowEndsFromOffer(offer: TradeOffer): Date | null | undefined {
    const offerWithEscrow = offer as TradeOfferWithEscrow;

    if (offerWithEscrow.rawJson) {
      try {
        const raw = JSON.parse(offerWithEscrow.rawJson) as {
          escrow_end_date?: number | null;
        };

        if (Object.prototype.hasOwnProperty.call(raw, 'escrow_end_date')) {
          return raw.escrow_end_date
            ? new Date(raw.escrow_end_date * 1000)
            : null;
        }
      } catch (err) {
        this.logger.warn(
          'Failed to parse raw offer data for escrow check',
          err,
        );
      }
    }

    return offerWithEscrow.escrowEnds;
  }

  private daysUntil(escrowEnds: Date | null): number {
    if (!(escrowEnds instanceof Date)) {
      return 0;
    }

    const msRemaining = escrowEnds.getTime() - Date.now();
    return msRemaining > 0
      ? Math.ceil(msRemaining / (SECONDS_PER_DAY * 1000))
      : 0;
  }

  private async getEscrowDaysWithTradeHoldDurations(
    offer: TradeOffer,
  ): Promise<number> {
    const offerWithEscrow = offer as TradeOfferWithEscrow;
    const manager = this.manager as TradeOfferManagerWithApiCall;
    const input: any = {
      steamid_target: offer.partner.getSteamID64(),
      trade_offer_access_token: offerWithEscrow._token || '',
    };

    return new Promise((resolve, reject) => {
      manager._apiCall(
        'GET',
        'GetTradeHoldDurations',
        1,
        input,
        (err, body) => {
          if (err) {
            return reject(err);
          }

          if (!this.hasTradeHoldDurationData(body)) {
            return reject(
              new Error(
                'GetTradeHoldDurations response did not include escrow durations',
              ),
            );
          }

          this.logger.debug(
            'Done checking escrow with trade hold durations WebAPI',
          );
          resolve(this.maxHoldDays(body));
        },
      );
    });
  }

  private hasTradeHoldDurationData(
    body?: TradeHoldDurationsResponse,
  ): body is TradeHoldDurationsResponse {
    return !!(
      body?.response?.my_escrow ||
      body?.response?.their_escrow ||
      body?.response?.both_escrow
    );
  }

  private maxHoldDays(body: TradeHoldDurationsResponse): number {
    const escrows = [
      body.response?.my_escrow,
      body.response?.their_escrow,
      body.response?.both_escrow,
    ];

    return escrows.reduce((max, escrow) => {
      if (!escrow) {
        return max;
      }

      const durationSeconds = Number(escrow.escrow_end_duration_seconds || 0);
      const endDateSeconds = Number(escrow.escrow_end_date || 0);

      const remainingFromEndDate = endDateSeconds
        ? Math.max(endDateSeconds - Date.now() / 1000, 0)
        : 0;

      const seconds = Math.max(durationSeconds, remainingFromEndDate);
      const days = Math.ceil(seconds / SECONDS_PER_DAY);

      return Math.max(max, days);
    }, 0);
  }

  private getEscrowDaysWithHtml(offer: TradeOffer): Promise<number> {
    return new Promise((resolve, reject) => {
      offer.getUserDetails((err, me, them) => {
        if (err) {
          return reject(err);
        }

        this.logger.debug('Done checking escrow via SteamCommunity HTML');
        resolve(Math.max(me.escrowDays, them.escrowDays));
      });
    });
  }
}
