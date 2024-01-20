import { Listing } from './listings';

export class Notification {
  id!: string;
  steamid!: string;
  lastMoved!: number;
  type!: number;
  bundle!: unknown;
  contents!: unknown;
}

export class ListingNotification extends Notification {
  override type!: 27;
  override bundle!: {
    listing: Listing;
    reason: string;
  };
  override contents!: {
    subject: string;
    message: string;
  };
}

export class BanNotification extends Notification {
  override type!: 27;
  override contents!: {
    subject: string;
    message: string;
  };
}
