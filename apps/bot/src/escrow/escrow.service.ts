import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import SteamID from 'steamid';
import { FriendsService } from '../friends/friends.service';
import { TradesService } from '../trades/trades.service';
import TradeOffer from 'steam-tradeoffer-manager/lib/classes/TradeOffer';
import TradeOfferManager from 'steam-tradeoffer-manager';

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

  private async getOffer(
    steamid: SteamID,
    isFriend: boolean,
    token?: string,
    offerId?: string,
  ) {
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
    const isFriend = await this.friendsService.isFriend(steamid);

    if (token || isFriend) {
      return this.getEscrowDaysWithTradeHoldDurations(steamid, token).catch(
        async (err) => {
          this.logger.warn(
            'Failed to check escrow with WebAPI, falling back to SteamCommunity HTML',
            err,
          );
          const offer = await this.getOffer(steamid, isFriend, token, offerId);
          return this.getEscrowDaysWithHtml(offer);
        },
      );
    }

    const offer = await this.getOffer(steamid, isFriend, token, offerId);
    return this.getEscrowDaysWithHtml(offer);
  }

  private async getEscrowDaysWithTradeHoldDurations(
    steamid: SteamID,
    token: string | undefined,
  ): Promise<number> {
    const manager = this.manager as TradeOfferManagerWithApiCall;

    return new Promise((resolve, reject) => {
      manager._apiCall(
        'GET',
        'GetTradeHoldDurations',
        1,
        {
          steamid_target: steamid.getSteamID64(),
          trade_offer_access_token: token || '',
        },
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
