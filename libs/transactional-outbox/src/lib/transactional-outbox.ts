import { EventMetadata } from '@tf2-automatic/bot-data';

export const OUTBOX_KEY = 'transactional-outbox';

export interface OutboxMessage {
  type: string;
  data: object;
  metadata: EventMetadata;
}
