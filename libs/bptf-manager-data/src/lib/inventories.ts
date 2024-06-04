import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export const INVENTORIES_BASE_URL = '/inventories';
const INVENTORY_PATH = '/:steamid';
export const INVENTORY_STATUS_PATH = `${INVENTORY_PATH}/status`;
export const INVENTORY_REFRESH_PATH = `${INVENTORY_PATH}/refresh`;

export const INVENTORY_FULL_PATH = INVENTORIES_BASE_URL + INVENTORY_PATH;
export const INVENTORY_STATUS_FULL_PATH =
  INVENTORIES_BASE_URL + INVENTORY_STATUS_PATH;
export const INVENTORY_REFRESH_FULL_PATH =
  INVENTORIES_BASE_URL + INVENTORY_REFRESH_PATH;

export class InventoryStatus {
  @ApiProperty({
    example: Math.floor(Date.now() / 1000),
    description: 'The current time according to backpack.tf',
    type: Number,
  })
  current_time!: number;

  @ApiProperty({
    example: Math.floor(Date.now() / 1000),
    description: 'The last time the status changed',
    type: Number,
  })
  last_update!: number;

  @ApiProperty({
    example: Math.floor(Date.now() / 1000),
    description: 'The last time the inventory was refreshed',
    type: Number,
  })
  timestamp!: number;

  @ApiProperty({
    example: Math.floor(Date.now() / 1000),
    description: 'The next time the inventory needs to be updated',
    type: Number,
  })
  next_update!: number;

  @ApiProperty({
    example: 180,
    description: 'The minimum time in seconds between inventory refreshes',
    type: Number,
  })
  refresh_interval!: number;
}

export class RefreshInventoryDto {
  @ApiProperty({
    example: Math.floor(Date.now() / 1000),
    description: 'Time for when the inventory needs to be refreshed after',
    type: Number,
    required: false,
  })
  @IsInt()
  @IsPositive()
  @IsOptional()
  time?: number;
}
