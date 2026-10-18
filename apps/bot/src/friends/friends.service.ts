import { Injectable, Logger } from '@nestjs/common';
import SteamUser from 'steam-user';
import SteamID from 'steamid';
import {
  FriendMessageEvent,
  FriendRelationshipEvent,
  Friends,
  FriendTypingEvent,
  FRIEND_MESSAGE_EVENT,
  FRIEND_RELATIONSHIP_EVENT,
  FRIEND_TYPING_EVENT,
  SendFriendMessageResponse,
  Friend,
} from '@tf2-automatic/bot-data';
import { BotService } from '../bot/bot.service';
import { EventsService } from '../events/events.service';
import { Gauge } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class FriendsService {
  private readonly logger = new Logger(FriendsService.name);

  private readonly client = this.botService.getClient();

  constructor(
    private readonly botService: BotService,
    private readonly eventsService: EventsService,
    @InjectMetric('bot_friend_relationships')
    private readonly friendRelationships: Gauge,
  ) {
    this.client.on('friendsList', () => {
      this.updateFriendRelationsMetric();
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.client.on(
      'friendRelationship',
      (steamID, relationship, oldRelationship) => {
        this.updateFriendRelationsMetric();

        this.eventsService
          .publish(FRIEND_RELATIONSHIP_EVENT, {
            steamid64: steamID.getSteamID64(),
            relationship,
            oldRelationship,
          } as FriendRelationshipEvent['data'])
          .catch(() => {
            // Ignore error
          });
      },
    );

    this.client.chat.on('friendTyping', (message) => {
      this.eventsService
        .publish(FRIEND_TYPING_EVENT, {
          steamid64: message.steamid_friend.getSteamID64(),
          timestamp: Math.floor(message.server_timestamp.getTime() / 1000),
          ordinal: message.ordinal,
        } as FriendTypingEvent['data'])
        .catch(() => {
          // Ignore error
        });
    });

    this.client.chat.on('friendMessage', (message) => {
      this.eventsService
        .publish(FRIEND_MESSAGE_EVENT, {
          steamid64: message.steamid_friend.getSteamID64(),
          timestamp: Math.floor(message.server_timestamp.getTime() / 1000),
          ordinal: message.ordinal,
          message: message.message,
        } as FriendMessageEvent['data'])
        .catch(() => {
          // Ignore error
        });
    });
  }

  private updateFriendRelationsMetric() {
    const relations = Object.values(this.client.myFriends);

    this.friendRelationships.set(
      {
        relationship: 'friends',
      },
      relations.filter((r) => r === SteamUser.EFriendRelationship.Friend)
        .length,
    );
    this.friendRelationships.set(
      {
        relationship: 'invited',
      },
      relations.filter(
        (r) => r === SteamUser.EFriendRelationship.RequestInitiator,
      ).length,
    );
    this.friendRelationships.set(
      {
        relationship: 'invitedUs',
      },
      relations.filter(
        (r) => r === SteamUser.EFriendRelationship.RequestRecipient,
      ).length,
    );
    this.friendRelationships.set(
      {
        relationship: 'blocked',
      },
      relations.filter((r) => r === SteamUser.EFriendRelationship.Blocked)
        .length,
    );
  }

  async getFriends(): Promise<Friends> {
    return Object.keys(this.client.myFriends).map((steamid64) => {
      const relationship = this.client.myFriends[steamid64];

      return {
        steamid64,
        relationship,
      };
    });
  }

  async getFriend(steamid: SteamID): Promise<Friend> {
    const relationship = this.client.myFriends[steamid.getSteamID64()];

    return {
      steamid64: steamid.getSteamID64(),
      relationship,
    };
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
    const steamid64 = steamid.getSteamID64();
    this.logger.debug(`Deleting friend ${steamid64}...`);

    return new Promise<void>((resolve, reject) => {
      // Not a friend, nothing to delete
      if (this.client.myFriends[steamid64] === undefined) {
        return resolve();
      }

      // Per-user event isn't in steam-user's typings
      const event = ('friendRelationship#' + steamid64) as 'friendRelationship';

      const timeout = setTimeout(() => {
        this.client.removeListener(event, listener);
        reject(new Error('Timeout'));
      }, 5000);

      const listener = (
        _sid: SteamID,
        relationship: SteamUser.EFriendRelationship,
      ) => {
        if (relationship === SteamUser.EFriendRelationship.None) {
          clearTimeout(timeout);
          this.client.removeListener(event, listener);
          return resolve();
        }
      };

      this.client.on(event, listener);

      this.client.removeFriend(steamid);
    })
      .then(() => {
        this.logger.debug(`Deleted friend ${steamid64}`);
      })
      .catch((err) => {
        this.logger.error('Error deleting friend: ' + err.message);
        throw err;
      });
  }

  isFriend(steamid: SteamID): Promise<boolean> {
    return this.getFriend(steamid).then(
      (friend) => friend.relationship === SteamUser.EFriendRelationship.Friend,
    );
  }

  blockUser(steamid: SteamID): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.blockUser(steamid, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  unblockUser(steamid: SteamID): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.unblockUser(steamid, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  sendFriendMessage(
    steamid: SteamID,
    message: string,
  ): Promise<SendFriendMessageResponse> {
    return this.client.chat
      .sendFriendMessage(steamid, message)
      .then((result) => {
        return {
          modified_message: result.modified_message,
          server_timestamp: Math.floor(
            result.server_timestamp.getTime() / 1000,
          ),
          ordinal: result.ordinal,
        };
      });
  }

  sendFriendTyping(steamid: SteamID): Promise<void> {
    return this.client.chat.sendFriendTyping(steamid).then(() => undefined);
  }
}
