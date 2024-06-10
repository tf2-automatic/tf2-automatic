export const BOT_EXCHANGE_NAME = 'tf2-automatic.bot';

export interface EventMetadata {
  id: string;
  steamid64: string | null;
  time: number;
}

export interface BaseEvent<T, Y = unknown> {
  type: T;
  data: Y;
  metadata: EventMetadata;
}
