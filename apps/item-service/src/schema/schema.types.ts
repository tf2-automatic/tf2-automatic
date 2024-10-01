import { AttachedParticle, SchemaItem } from '@tf2-automatic/item-service-data';
import { Job } from 'bullmq';

export type JobName = 'schema' | 'items' | 'proto_obj_defs';

export type JobWithTypes = Job<JobData, unknown, JobName>;

export interface JobData {
  time: number;
  start?: number;
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

export interface OriginName {
  origin: number;
  name: string;
}

export interface Attribute {
  name: string;
  defindex: number;
  attribute_class?: string;
  description_string?: string;
  description_format?: string;
  effect_type: string;
  hidden: boolean;
  stored_as_integer: boolean;
}

export interface ItemSetAttribute {
  name: string;
  class: string;
  value: number;
}

export interface ItemSet {
  item_set: string;
  name: string;
  items: string[];
  attributes?: ItemSetAttribute[];
  store_bundle?: string;
}

export interface Level {
  level: number;
  required_score: number;
  name: string;
}

export interface ItemLevel {
  name: string;
  levels: Level[];
}

export interface KillEaterTypeScore {
  type: number;
  type_name: string;
  level_data: string;
}

export interface StringLookupString {
  index: number;
  string: string;
}

export interface StringLookup {
  table_name: string;
  strings: StringLookupString[];
}

export interface GetSchemaOverviewResponse {
  status: number;
  items_game_url: string;
  qualities: Record<string, number>;
  qualityNames: Record<string, string>;
  originNames: OriginName[];
  attributes: Attribute[];
  item_sets: ItemSet[];
  attribute_controlled_attached_particles: AttachedParticle[];
  item_levels: ItemLevel[];
  kill_eater_score_types: KillEaterTypeScore[];
  string_lookups: StringLookup[];
}
