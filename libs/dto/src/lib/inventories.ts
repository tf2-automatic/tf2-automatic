import { ApiProperty } from '@nestjs/swagger';
import { IsSteamID } from '@tf2-automatic/is-steamid-validator';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { QueueRetryDto } from './misc';
import { EnqueueInventory } from '@tf2-automatic/bot-manager-data';

export class EnqueueInventoryDto implements EnqueueInventory {
  @ApiProperty({
    description: 'The steamid64 of the bot to fetch the inventory with',
    example: '76561198120070906',
  })
  @IsSteamID()
  @IsOptional()
  bot?: string;

  @ApiProperty({
    description:
      'The priority of the job. The closter to 1 the higher the priority.',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  priority?: number;

  @ApiProperty({
    description: 'The options for the job',
    type: QueueRetryDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QueueRetryDto)
  retry?: QueueRetryDto;

  @ApiProperty({
    description:
      'The time that the inventory will be cached for in seconds. -1 means forever.',
    example: 3600,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(-1)
  @Max(Number.MAX_SAFE_INTEGER)
  ttl?: number;
}
