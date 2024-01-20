import { ApiProperty } from '@nestjs/swagger';
import { Listing } from './listings';

export class Notification {
  id!: string;
  steamid!: string;
  lastMoved!: number;
  type!: number;
  bundle?: unknown;
  contents!: {
    subject: string;
    message: string;
  };
}

export class ListingNotification extends Notification {
  override type!: 27;
  override bundle!: {
    listing: Listing;
    reason: string;
  };
}

export class NotificationModel implements Notification {
  @ApiProperty({
    description: 'The notification ID',
  })
  id!: string;

  @ApiProperty({
    description: 'The SteamID64 of the user that owns the notification',
  })
  steamid!: string;

  @ApiProperty({
    description: 'The unix timestamp of when the notification was last moved',
  })
  lastMoved!: number;

  @ApiProperty({
    description: 'The type of the notification',
  })
  type!: number;

  @ApiProperty({
    description: 'The bundle of the notification (if any)',
  })
  bundle?: unknown;

  @ApiProperty({
    description: 'The contents of the notification',
  })
  contents!: {
    subject: string;
    message: string;
  };
}
