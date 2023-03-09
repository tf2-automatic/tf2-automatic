export const BOT_EXCHANGE_NAME = 'bot';

export interface EventMetadata {
  steamid64: string | null;
  time: number;
}

export interface BaseEvent {
  type: string;
  data: unknown;
  metadata: EventMetadata;
}
