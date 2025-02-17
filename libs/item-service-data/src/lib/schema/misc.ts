import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export interface Quality {
  id: number;
  name: string;
}

export interface AttachedParticle {
  system: string;
  id: number;
  attach_to_rootbone: boolean;
  name: string;
  attachment?: string;
}

export interface PaintKit {
  id: number;
  name: string;
}

export interface Spell {
  id: number;
  name: string;
}

export interface StrangePart {
  id: number;
  name: string;
  defindex: number;
}

export class QualityModel implements Quality {
  @ApiProperty({
    example: 6,
  })
  id!: number;

  @ApiProperty({
    example: 'Unique',
  })
  name!: string;
}

export class AttachedParticleModel {
  @ApiProperty({
    example: 'superrare_burning1',
  })
  system!: string;

  @ApiProperty({
    example: 13,
  })
  id!: number;

  @ApiProperty({
    example: true,
  })
  attach_to_rootbone!: boolean;

  @ApiProperty({
    example: 'muzzle',
  })
  attachment?: string | undefined;

  @ApiProperty({
    example: 'Burning Flames',
  })
  name!: string;
}

export class PaintKitModel implements PaintKit {
  @ApiProperty({
    example: 14,
  })
  id!: number;

  @ApiProperty({
    example: 'Night Owl',
  })
  name!: string;
}

export class SpellModel implements Spell {
  @ApiProperty({
    example: 1009,
  })
  id!: number;

  @ApiProperty({
    example: 'Exorcism',
  })
  name!: string;
}

export class StrangePartModel implements StrangePart {
  @ApiProperty({
    example: 27,
  })
  id!: number;

  @ApiProperty({
    example: 'Strange Part: Full Moon Kills',
  })
  name!: string;

  @ApiProperty({
    example: 6015,
  })
  defindex!: number;
}

export class SchemaQueryDto {
  @IsUrl()
  itemsGameUrl: string;
}
