import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import SteamID from 'steamid';
import { FriendsService } from '../friends/friends.service';
import TradeOffer from 'steam-tradeoffer-manager/lib/classes/TradeOffer';

@Injectable()
export class EscrowService {
  private readonly manager = this.botService.getManager();

  constructor(
    private readonly botService: BotService,
    private readonly friendsService: FriendsService,
  ) {}

  async getEscrowDuration(steamid: SteamID, token?: string): Promise<number> {
    if (!token) {
      const isFriend = await this.friendsService.isFriend(steamid);

      if (!isFriend) {
        throw new BadRequestException(
          'Token is required when not friends with the user',
        );
      }
    }

    const offer = this.manager.createOffer(steamid, token);
    const details = await this.getUserDetails(offer);

    return Math.max(details.me.escrowDays, details.them.escrowDays);
  }

  private getUserDetails(offer: TradeOffer): Promise<{
    me: TradeOffer.UserDetails;
    them: TradeOffer.UserDetails;
  }> {
    return new Promise((resolve, reject) => {
      offer.getUserDetails((err, me, them) => {
        if (err) {
          if (
            err.message.endsWith(
              `'s inventory privacy is set to "Private".  They are unable to receive trade offers.`,
            )
          ) {
            return reject(new UnauthorizedException('Inventory is private'));
          } else if (err.message.endsWith(' because they have a trade ban.')) {
            return reject(new BadRequestException('User is trade banned'));
          } else if (
            err.message.startsWith(
              'This Trade URL is no longer valid for sending a trade offer to ',
            )
          ) {
            return reject(
              new BadRequestException('Trade offer token is invalid'),
            );
          }

          return reject(err);
        }

        resolve({ me, them });
      });
    });
  }
}
