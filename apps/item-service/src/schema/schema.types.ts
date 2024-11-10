import { SchemaItem } from '@tf2-automatic/item-service-data';
import { Job } from 'bullmq';

export type JobName =
  | 'schema'
  | 'url'
  | 'overview'
  | 'items'
  | 'proto_obj_defs'
  | 'items_game';

export type JobWithTypes = Job<JobData, unknown, JobName>;

export interface JobData {
  time: number;
  start?: number;
  items_game_url?: string;
}

export interface SchemaItemsJobData {
  start: number | null;
}

export interface GetSchemaItemsResponse {
  status: number;
  items_game_url: string;
  note?: string;
  items: SchemaItem[];
  next?: number;
}
