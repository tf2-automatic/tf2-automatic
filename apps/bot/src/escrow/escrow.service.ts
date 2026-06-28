import { BadRequestException, Injectable } from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import SteamID from 'steamid';
import { FriendsService } from '../friends/friends.service';
import { TradesService } from '../trades/trades.service';

@Injectable()
export class EscrowService {
  private readonly manager = this.botService.getManager();

  constructor(
    private readonly botService: BotService,
    private readonly friendsService: FriendsService,
    private readonly tradesService: TradesService,
  ) {}

  private async getOffer(steamid: SteamID, token?: string, offerId?: string) {
    if (offerId) {
      return this.tradesService.getActualOffer(offerId);
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

    const details = await this.tradesService.getUserDetails(offer);

    return Math.max(details.me.escrowDays, details.them.escrowDays);
  }
}
