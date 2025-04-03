import { SKU, Item } from '@tf2-automatic/tf2-format';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { BaseEvent, HttpError } from '@tf2-automatic/bot-data';

export const INVENTORIES_BASE_PATH = '/inventories';
export const INVENTORIES_PATH = '/';

export const INVENTORY_PATH = '/:steamid';
export const INVENTORY_QUEUE_PATH = `${INVENTORY_PATH}/queue`;
export const INVENTORY_FETCH_PATH = `${INVENTORY_PATH}/fetch`;

export interface InventoryResponse {
  timestamp: number;
  ttl: number;
  items: Record<string, string[]>;
  attributes: Record<string, Partial<Item>>;
}

export const INVENTORY_EVENT_PREFIX = 'inventories';

export type InventoryLoadedEventType = 'inventories.loaded';
export const INVENTORY_LOADED_EVENT: InventoryLoadedEventType = `${INVENTORY_EVENT_PREFIX}.loaded`;

export type InventoryLoadedEvent = BaseEvent<
  InventoryLoadedEventType,
  {
    steamid64: string;
    timestamp: number;
    itemCount: number;
  }
>;

export interface InventoryJobOptions {
  steamid64: string;
  ttl?: number;
  tradableOnly?: boolean;
}

interface InventoryEventData {
  job: InventoryJobOptions;
  response: HttpError | null;
  error: string;
}

export type InventoryErrorEventType = 'inventories.error';
export const INVENTORY_ERROR_EVENT: InventoryErrorEventType = `${INVENTORY_EVENT_PREFIX}.error`;

export type InventoryErrorEvent = BaseEvent<
  InventoryErrorEventType,
  InventoryEventData
>;

export type InventoryFailedEventType = 'inventories.failed';
export const INVENTORY_FAILED_EVENT: InventoryFailedEventType = `${INVENTORY_EVENT_PREFIX}.failed`;

export type InventoryFailedEvent = BaseEvent<
  InventoryFailedEventType,
  InventoryEventData
>;

@ValidatorConstraint({ name: 'IsKeyOfItem', async: false })
class IsKeyOfItemConstraint implements ValidatorConstraintInterface {
  validate(keys: string[] | undefined): boolean {
    if (!keys) {
      return false;
    }

    const validKeys = new Set(Object.keys(SKU.getDefault()));
    return keys.every((key) => validKeys.has(key as keyof Item));
  }

  defaultMessage(): string {
    return 'each value in $property must be a valid item attribute.';
  }
}

export class GetInventoryDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Validate(IsKeyOfItemConstraint)
  @Type(() => String)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',');
    }
    return value;
  })
  extract: (keyof Item)[] = [];
}
