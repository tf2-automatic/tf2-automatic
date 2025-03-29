import { IsEnum, IsOptional } from 'class-validator';
import { BaseEvent } from '@tf2-automatic/bot-data';
import { ApiProperty } from '@nestjs/swagger';

export const SCHEMA_BASE_PATH = '/schema';
export const SCHEMA_PATH = '/';
export const SCHEMA_REFRESH_PATH = '/refresh';
export const SCHEMA_ITEMS_GAME_PATH = '/items_game';
export const SCHEMA_OVERVIEW_PATH = '/overview';
export const SCHEMA_ITEMS_PATH = '/items';

export const SCHEMA_BY_TIME_PATH = '/:time';

export const SCHEMA_ITEM_DEFINDEX_PATH = SCHEMA_ITEMS_PATH + '/:defindex';
export const SCHEMA_ITEMS_SEARCH_PATH = SCHEMA_ITEMS_PATH + '/search';

export const SCHEMA_QUALITY_PATH = '/qualities/:idOrName';
export const SCHEMA_EFFECT_PATH = '/effects/:idOrName';
export const SCHEMA_PAINTKIT_PATH = '/paintkits/:idOrName';
export const SCHEMA_SPELL_PATH = '/spells/:idOrName';
export const SCHEMA_STRANGE_PART_PATH = '/parts/:idOrName';
export const SCHEMA_PAINT_PATH = '/paints/:color';

export const SCHEMA_FULL_PATH = SCHEMA_BASE_PATH + SCHEMA_PATH;
export const SCHEMA_REFRESH_FULL_PATH = SCHEMA_BASE_PATH + SCHEMA_REFRESH_PATH;
export const SCHEMA_ITEMS_GAME_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_ITEMS_GAME_PATH;
export const SCHEMA_OVERVIEW_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_OVERVIEW_PATH;
export const SCHEMA_ITEMS_FULL_PATH = SCHEMA_BASE_PATH + SCHEMA_ITEMS_PATH;

export const SCHEMA_BY_TIME_FULL_PATH = SCHEMA_BASE_PATH + SCHEMA_BY_TIME_PATH;

export const SCHEMA_ITEM_DEFINDEX_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_ITEM_DEFINDEX_PATH;
export const SCHEMA_ITEMS_SEARCH_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_ITEMS_SEARCH_PATH;

export const SCHEMA_QUALITY_FULL_PATH = SCHEMA_BASE_PATH + SCHEMA_QUALITY_PATH;

export const SCHEMA_EFFECT_FULL_PATH = SCHEMA_BASE_PATH + SCHEMA_EFFECT_PATH;

export const SCHEMA_PAINTKIT_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_PAINTKIT_PATH;

export const SCHEMA_SPELL_FULL_PATH = SCHEMA_BASE_PATH + SCHEMA_SPELL_PATH;

export const SCHEMA_STRANGE_PART_FULL_PATH =
  SCHEMA_BASE_PATH + SCHEMA_STRANGE_PART_PATH;

export const SCHEMA_PAINT_FULL_PATH = SCHEMA_BASE_PATH + SCHEMA_PAINT_PATH;

export enum SchemaRefreshAction {
  // Only check for new schema version if not recently checked
  DEFAULT = 'default',
  // Force the schema version to be checked
  CHECK = 'check',
  // Force the schema to be updated
  FORCE = 'force',
}

export class SchemaRefreshDto {
  @IsEnum(SchemaRefreshAction)
  @IsOptional()
  action: SchemaRefreshAction = SchemaRefreshAction.DEFAULT;
}

export interface UpdateSchemaResponse {
  enqueued: boolean;
}

export interface Schema {
  version: string;
  time: number;
  consistent: boolean;
}

type Bool = '0' | '1';

export interface ItemsGameItem {
  name: string;
  def_index: string;
  item_class?: string;
  first_sale_date?: string;
  prefab?: string;
  craft_class?: string;
  craft_material_type?: string;
  item_quality?: string;
  min_ilevel?: string;
  max_ilevel?: string;
  item_slot?: string;
  used_by_classes?: Record<string, Bool>;
  capabilities?: Record<string, Bool>;
  static_attrs?: Record<string, string>;
  attributes?: Record<
    string,
    {
      attribute_class: string;
      value: string;
    }
  >;
  propername?: Bool;
  expiration_date?: string;
}

export type SchemaEventType = 'schema.updated';
export const SCHEMA_EVENT: SchemaEventType = `schema.updated`;

export type SchemaEvent = BaseEvent<SchemaEventType, Schema>;

export class SchemaModel {
  @ApiProperty({
    example:
      'http://media.steampowered.com/apps/440/scripts/items/items_game.cab5453ec6f504e4738685f5d0c0468db8feaee1.txt',
    description: 'The URL to the items game',
  })
  version!: string;

  @ApiProperty({
    example: Math.floor(Date.now() / 1000),
    description: 'The time the schema started being fetched',
  })
  time!: number;

  @ApiProperty({
    example: true,
    description:
      'Whether the versions before and after fetching the schema are consistent',
  })
  consistent!: boolean;
}
