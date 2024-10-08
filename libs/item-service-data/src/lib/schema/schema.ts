import { AttachedParticle } from './misc';

export interface UpdateSchemaResponse {
  enqueued: boolean;
}

export interface SchemaMetadataResponse {
  itemsGameUrl: string;
  itemsCount: number;
  updating: boolean;
  lastUpdated: number;
}

interface OriginName {
  origin: number;
  name: string;
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

interface ItemSetAttribute {
  name: string;
  class: string;
  value: number;
}

interface ItemSet {
  item_set: string;
  name: string;
  items: string[];
  attributes?: ItemSetAttribute[];
  store_bundle?: string;
}

interface Level {
  level: number;
  required_score: number;
  name: string;
}

interface ItemLevel {
  name: string;
  levels: Level[];
}

interface KillEaterTypeScore {
  type: number;
  type_name: string;
  level_data: string;
}

interface StringLookupString {
  index: number;
  string: string;
}

interface StringLookup {
  table_name: string;
  strings: StringLookupString[];
}

export interface SchemaOverviewResponse {
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
