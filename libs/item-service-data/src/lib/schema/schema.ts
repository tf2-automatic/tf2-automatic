import { BaseEvent } from '../events';
import { AttachedParticle } from './misc';

export const SCHEMA_BASE_PATH = '/schema';
export const SCHEMA_PATH = '/';
export const SCHEMA_REFRESH_PATH = '/refresh';
export const SCHEMA_ITEMS_GAME_PATH = '/items_game';
export const SCHEMA_OVERVIEW_PATH = '/overview';
export const SCHEMA_ITEMS_PATH = '/items';

const SCHEMA_ITEMS_DEFINDEX_PATH = SCHEMA_ITEMS_PATH + '/defindex';
export const SCHEMA_ITEM_DEFINDEX_PATH =
  SCHEMA_ITEMS_DEFINDEX_PATH + '/:defindex';
const SCHEMA_ITEMS_NAME_PATH = SCHEMA_ITEMS_PATH + '/name';
export const SCHEMA_ITEM_NAME_PATH = SCHEMA_ITEMS_NAME_PATH + '/:name';

const SCHEMA_QUALITIES_NAME_PATH = '/qualities/name';
export const SCHEMA_QUALITY_NAME_PATH = SCHEMA_QUALITIES_NAME_PATH + '/:name';
const SCHEMA_QUALITIES_ID_PATH = '/qualities/id';
export const SCHEMA_QUALITY_ID_PATH = SCHEMA_QUALITIES_ID_PATH + '/:id';

const SCHEMA_EFFECTS_NAME_PATH = '/effects/name';
export const SCHEMA_EFFECT_NAME_PATH = SCHEMA_EFFECTS_NAME_PATH + '/:name';
const SCHEMA_EFFECTS_ID_PATH = '/effects/id';
export const SCHEMA_EFFECT_ID_PATH = SCHEMA_EFFECTS_ID_PATH + '/:id';

const SCHEMA_PAINTKITS_NAME_PATH = '/paintkits/name';
export const SCHEMA_PAINTKIT_NAME_PATH = SCHEMA_PAINTKITS_NAME_PATH + '/:name';
const SCHEMA_PAINTKITS_ID_PATH = '/paintkits/id';
export const SCHEMA_PAINTKIT_ID_PATH = SCHEMA_PAINTKITS_ID_PATH + '/:id';

const SCHEMA_SPELLS_NAME_PATH = '/spells/name';
export const SCHEMA_SPELL_NAME_PATH = SCHEMA_SPELLS_NAME_PATH + '/:name';
const SCHEMA_SPELLS_ID_PATH = '/spells/id';
export const SCHEMA_SPELL_ID_PATH = SCHEMA_SPELLS_ID_PATH + '/:id';

export const SCHEMA_FULL_PATH = SCHEMA_BASE_PATH + SCHEMA_PATH;
export const SCHEMA_REFRESH_FULL_PATH = SCHEMA_BASE_PATH + SCHEMA_REFRESH_PATH;
export const SCHEMA_ITEMS_GAME_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_ITEMS_GAME_PATH;
export const SCHEMA_OVERVIEW_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_OVERVIEW_PATH;
export const SCHEMA_ITEMS_FULL_PATH = SCHEMA_BASE_PATH + SCHEMA_ITEMS_PATH;

export const SCHEMA_ITEM_DEFINDEX_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_ITEM_DEFINDEX_PATH;
export const SCHEMA_ITEM_NAME_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_ITEM_NAME_PATH;

export const SCHEMA_QUALITY_NAME_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_QUALITY_NAME_PATH;
export const SCHEMA_QUALITY_ID_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_QUALITY_ID_PATH;

export const SCHEMA_EFFECT_NAME_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_EFFECT_NAME_PATH;
export const SCHEMA_EFFECT_ID_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_EFFECT_ID_PATH;

export const SCHEMA_PAINTKIT_NAME_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_PAINTKIT_NAME_PATH;
export const SCHEMA_PAINTKIT_ID_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_PAINTKIT_ID_PATH;

export interface UpdateSchemaResponse {
  enqueued: boolean;
}

export interface Schema {
  itemsGameUrl: string;
  checkedAt: number;
  updatedAt: number;
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

export type SchemaEventType = 'schema.updated';
export const SCHEMA_EVENT: SchemaEventType = `schema.updated`;

export type SchemaEvent = BaseEvent<SchemaEventType, Schema>;
