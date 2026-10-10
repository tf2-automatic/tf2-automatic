import { Injectable, Logger } from '@nestjs/common';
import SteamUser from 'steam-user';
import { BotService } from '../bot/bot.service';
import { EventsService } from '../events/events.service';
import { NotificationsClearDto } from '@tf2-automatic/dto';
import {
  NOTIFICATION_RECEIVED_EVENT,
  SteamNotification,
} from '@tf2-automatic/bot-data';

type SteamUserWithNotifications = SteamUser & {
  markNotificationsRead(notificationIds: Array<string | number>): void;
  markAllNotificationsRead(): void;
  on(
    event: 'notificationsReceived',
    listener: (payload: { notifications: SteamNotification[] }) => void,
  ): SteamUserWithNotifications;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly client =
    this.botService.getClient() as SteamUserWithNotifications;

  constructor(
    private readonly botService: BotService,
    private readonly eventsService: EventsService,
  ) {
    this.client.on('notificationsReceived', (payload) => {
      this.eventsService
        .publish(NOTIFICATION_RECEIVED_EVENT, payload)
        .catch(() => {
          this.logger.warn(`Unable to publish ${NOTIFICATION_RECEIVED_EVENT}`);
        });
    });
  }

  clearNotifications(dto: NotificationsClearDto) {
    if (dto.clearAll) {
      this.client.markAllNotificationsRead();
      return;
    }

    this.client.markNotificationsRead(dto.ids);
  }
}
