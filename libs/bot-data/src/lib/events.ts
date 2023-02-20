export interface EventMetadata {
  steamid64: string | null;
  time: number;
}

export interface BaseEvent {
  type: string;
  data: unknown;
  metadata: EventMetadata;
}
