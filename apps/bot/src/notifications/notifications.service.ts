import { Injectable } from '@nestjs/common';
import {
  SteamNotification,
  NotificationsRead,
  NotificationsReceivedEvent,
  NOTIFICATIONS_RECEIVED_EVENT,
} from '@tf2-automatic/bot-data';
import { BotService } from '../bot/bot.service';
import { EventsService } from '../events/events.service';

interface RawNotification extends Omit<
  SteamNotification,
  'timestamp' | 'expiry' | 'viewed'
> {
  timestamp: Date | null;
  expiry: Date | null;
  viewed: Date | null;
}

// Not in @types/steam-user
interface NotificationsClient {
  on(
    event: 'notificationsReceived',
    listener: (payload: { notifications: RawNotification[] }) => void,
  ): void;
  markNotificationsRead(ids: string[]): void;
  markAllNotificationsRead(): void;
}

function toUnix(date: Date | null): number | null {
  return date ? Math.floor(date.getTime() / 1000) : null;
}

@Injectable()
export class NotificationsService {
  private readonly client =
    this.botService.getClient() as unknown as NotificationsClient;

  constructor(
    private readonly botService: BotService,
    private readonly eventsService: EventsService,
  ) {
    this.client.on('notificationsReceived', ({ notifications }) => {
      this.eventsService
        .publish(NOTIFICATIONS_RECEIVED_EVENT, {
          notifications: notifications.map((notification) => ({
            ...notification,
            timestamp: toUnix(notification.timestamp),
            expiry: toUnix(notification.expiry),
            viewed: toUnix(notification.viewed),
          })),
        } satisfies NotificationsReceivedEvent['data'])
        .catch(() => {
          // Ignore error
        });
    });
  }

  markRead(dto: NotificationsRead): void {
    if (dto.all) {
      this.client.markAllNotificationsRead();
    } else if (dto.ids) {
      this.client.markNotificationsRead(dto.ids);
    }
  }
}
