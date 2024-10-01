export const ITEM_SERVICE_EXCHANGE_NAME = 'tf2-automatic.item-service';

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
