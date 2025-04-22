import { AttachedParticle, SchemaItem } from '@tf2-automatic/item-service-data';
import { Job } from 'bullmq';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

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

export interface KillEaterTypeScore {
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
  kill_eater_score_types: KillEaterTypeScore[];
  string_lookups: unknown;
}

export class SchemaOptionsDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  time?: number;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  items_game = false;
}

export class SchemaPaginatedDto {
  @IsInt()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  count = 1000;

  @IsOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  cursor = 0;
}

export class SchemaSearchDto {
  @IsString()
  @IsDefined()
  name: string;
}
