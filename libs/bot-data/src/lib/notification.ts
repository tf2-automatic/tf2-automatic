import { BaseEvent } from './events';

export const NOTIFICATION_BASE_URL = '/notification';

export const NOTIFICATION_CLEAR_PATH = '/clear';

export const NOTIFICATION_CLEAR_FULL_PATH = `${NOTIFICATION_BASE_URL}${NOTIFICATION_CLEAR_PATH}`;

export const NOTIFICATION_EVENT_PREFIX = 'notification';

export type NotificationReceivedType = 'notification.received';
export const NOTIFICATION_RECEIVED_EVENT: NotificationReceivedType = `${NOTIFICATION_EVENT_PREFIX}.received`;

export enum ESteamNotificationType {
  Invalid = 0,
  Test = 1,
  Gift = 2,
  Comment = 3,
  Item = 4,
  FriendInvite = 5,
  MajorSale = 6,
  PreloadAvailable = 7,
  Wishlist = 8,
  TradeOffer = 9,
  General = 10,
  HelpRequest = 11,
  AsyncGame = 12,
  ChatMsg = 13,
  ModeratorMsg = 14,
  ParentalFeatureAccessRequest = 15,
  FamilyInvite = 16,
  FamilyPurchaseRequest = 17,
  ParentalPlaytimeRequest = 18,
  FamilyPurchaseRequestResponse = 19,
  ParentalFeatureAccessResponse = 20,
  ParentalPlaytimeResponse = 21,
  RequestedGameAdded = 22,
  SendToPhone = 23,
  ClipDownloaded = 24,
  TwoFactorPrompt = 25,
  MobileConfirmation = 26,
  PartnerEvent = 27,
}

//ESteamNotificationType = 3
export interface SteamCommentNotificationBody {
  owner_steam_id: string;
  bclan_account: number;
  forum_id: string;
  topic_id: string;
  thread_id: string;
  type: string; // note: string here, distinct from the outer notification's numeric `type`
  account_id: number;
  subscribed: number;
  last_post: number;
  text: string;
  title: string;
  bhas_friend: number;
  bis_forum: number;
  bis_owner: number;
  cgid: string;
}

export type SteamNotificationBody =
  SteamCommentNotificationBody | Record<string, any>;

export interface SteamNotification {
  id: string;
  type: ESteamNotificationType;
  targets: number;
  body: SteamNotificationBody;
  read: boolean;
  timestamp: string | null;
  hidden: boolean;
  expiry: string | null;
  viewed: string | null;
}

export type NotificationReceivedEvent = BaseEvent<
  NotificationReceivedType,
  {
    notifications: Array<SteamNotification>;
  }
>;
