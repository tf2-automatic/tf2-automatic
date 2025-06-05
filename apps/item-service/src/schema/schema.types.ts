import { AttachedParticle, SchemaItem } from '@tf2-automatic/item-service-data';
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
  force?: boolean;
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

interface Attribute {
  name: string;
  defindex: number;
  attribute_class?: string;
  description_string?: string;
  description_format?: string;
  effect_type: string;
  hidden: boolean;
  stored_as_integer: boolean;
}

export interface KillEaterScoreType {
  type: number;
  type_name: string;
  level_data: string;
}

export interface SchemaOverviewResponse {
  status: number;
  items_game_url: string;
  qualities: Record<string, number>;
  qualityNames: Record<string, string>;
  originNames: unknown;
  attributes: Attribute[];
  item_sets: unknown;
  attribute_controlled_attached_particles: AttachedParticle[];
  item_levels: unknown;
  kill_eater_score_types: KillEaterScoreType[];
  string_lookups: unknown;
}

export interface TempSpell {
  defindexes: number[];
  attribute: number;
  value: number;
}

export interface TempStrangePart {
  id: number;
  defindex: number;
}

export interface SchemaLookupOptions {
  time?: number;
  useClosestSchema?: boolean;
}
