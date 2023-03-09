export const BOT_EXCHANGE_NAME = 'tf2-automatic.bot';

export interface EventMetadata {
  steamid64: string | null;
  time: number;
}

export interface BaseEvent {
  type: string;
  data: unknown;
  metadata: EventMetadata;
}
