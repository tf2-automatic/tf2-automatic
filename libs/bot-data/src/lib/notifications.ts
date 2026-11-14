import { BaseEvent } from './events';

export const NOTIFICATIONS_BASE_URL = '/notifications';
export const NOTIFICATIONS_READ_PATH = '/read';

export const NOTIFICATIONS_READ_FULL_PATH = `${NOTIFICATIONS_BASE_URL}${NOTIFICATIONS_READ_PATH}`;

export interface NotificationsRead {
  ids?: string[];
  all?: true;
}

export interface SteamNotification {
  id: string;
  // ESteamNotificationType from steam-user
  type: number;
  targets: number;
  body: Record<string, unknown> | null;
  read: boolean;
  hidden: boolean;
  timestamp: number | null;
  expiry: number | null;
  viewed: number | null;
}

export type NotificationsReceivedEventType = 'notifications.received';

export const NOTIFICATIONS_EVENT_PREFIX = 'notifications';
export const NOTIFICATIONS_RECEIVED_EVENT: NotificationsReceivedEventType = `${NOTIFICATIONS_EVENT_PREFIX}.received`;

export type NotificationsReceivedEvent = BaseEvent<
  NotificationsReceivedEventType,
  {
    notifications: SteamNotification[];
  }
>;
