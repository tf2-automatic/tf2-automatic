import { Injectable, Logger } from '@nestjs/common';
import SteamUser from 'steam-user';
import SteamID from 'steamid';
import { Friends } from '@tf2-automatic/bot-data';
import { BotService } from '../bot/bot.service';

@Injectable()
export class FriendsService {
  private readonly logger = new Logger(FriendsService.name);

  private readonly client = this.botService.getClient();

  constructor(private readonly botService: BotService) {}

  async getFriends(): Promise<Friends> {
    return Object.keys(this.client.myFriends).map((steamid) => {
      const relationship = this.client.myFriends[steamid];

      return {
        steamid64: steamid,
        isFriend: relationship === SteamUser.EFriendRelationship.Friend,
        isInvited:
          relationship === SteamUser.EFriendRelationship.RequestInitiator,
        hasInvitedUs:
          relationship === SteamUser.EFriendRelationship.RequestRecipient,
      };
    });
  }

  addFriend(steamid: SteamID): Promise<boolean> {
    this.logger.debug(`Adding friend ${steamid.getSteamID64()}...`);

    return new Promise<boolean>((resolve, reject) => {
      this.client.addFriend(steamid, (err) => {
        if (err) {
          if (err.message === 'DuplicateName') {
            // Already friends
            return resolve(false);
          }

          return reject(err);
        }

        return resolve(true);
      });
    })
      .then((added) => {
        if (added) {
          this.logger.debug(`Added friend ${steamid.getSteamID64()}`);
        } else {
          this.logger.debug(`Already friends with ${steamid.getSteamID64()}`);
        }
        return added;
      })
      .catch((err) => {
        this.logger.error('Error adding friend: ' + err.message);
        throw err;
      });
  }

  deleteFriend(steamid: SteamID): Promise<void> {
    this.logger.debug(`Deleting friend ${steamid.getSteamID64()}...`);

    return new Promise<void>((resolve, reject) => {
      this.client.removeFriend(steamid);

      const timeout = setTimeout(() => {
        this.client.removeListener('friendRelationship', listener);
        reject(new Error('Timeout'));
      }, 5000);

      const listener = (
        sid: SteamID,
        relationship: SteamUser.EFriendRelationship
      ) => {
        if (
          steamid.getSteamID64() === sid.getSteamID64() &&
          relationship === SteamUser.EFriendRelationship.None
        ) {
          clearTimeout(timeout);
          return resolve();
        }
      };

      this.client.once('friendRelationship', listener);
    })
      .then(() => {
        this.logger.debug(`Deleted friend ${steamid.getSteamID64()}`);
      })
      .catch((err) => {
        this.logger.error('Error deleting friend: ' + err.message);
        throw err;
      });
  }

  async isFriend(steamid: SteamID): Promise<boolean> {
    return (
      this.client.myFriends[steamid.getSteamID64()] ===
      SteamUser.EFriendRelationship.Friend
    );
  }

  async isInvited(steamid: SteamID): Promise<boolean> {
    return (
      this.client.myFriends[steamid.getSteamID64()] ===
      SteamUser.EFriendRelationship.RequestInitiator
    );
  }

  async hasInvitedUs(steamid: SteamID): Promise<boolean> {
    return (
      this.client.myFriends[steamid.getSteamID64()] ===
      SteamUser.EFriendRelationship.RequestRecipient
    );
  }
}
