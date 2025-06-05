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
  defindexes: number[];
  name: string;
  attribute: number;
  value: number;
}

export interface StrangePart {
  id: number;
  defindex: number;
  type: string;
}

export interface Paint {
  defindex: number;
  primaryColor: string;
  secondaryColor: string | null;
}

export interface SchemaAttribute {
  name: string;
  defindex: number;
  attribute_class?: string;
  description_string?: string;
  description_format?: string;
  effect_type: string;
  hidden: boolean;
  stored_as_integer: boolean;
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
    description:
      'The defindexes of the items that could be used to apply this spell',
    example: [8905, 8906, 8907, 8908, 8909, 8910, 8911, 8912, 8913],
  })
  defindexes: number[];

  @ApiProperty({
    description:
      'The name of the spell. It is either the description of the spell attribute, or the name of the item that applies the spell.',
    example: 'Voices from Below',
  })
  name: string;

  @ApiProperty({
    description: 'The attribute defindex associated with the spell',
    example: 1006,
  })
  attribute: number;

  @ApiProperty({
    description: 'The value of the spell attribute',
    example: 1,
  })
  value: number;
}

export class StrangePartModel implements StrangePart {
  @ApiProperty({
    example: 27,
  })
  id!: number;

  @ApiProperty({
    example: 6015,
  })
  defindex!: number;

  @ApiProperty({
    example: 'Kills Under A Full Moon',
  })
  type!: string;
}

export class PaintModel implements Paint {
  @ApiProperty({
    example: 5037,
  })
  defindex!: number;

  @ApiProperty({
    example: 'e7b53b',
  })
  primaryColor!: string;

  @ApiProperty({
    example: null,
  })
  secondaryColor!: string | null;
}

export class SchemaAttributeModel implements SchemaAttribute {
  @ApiProperty({
    example: 'SPELL: Halloween voice modulation',
  })
  name!: string;

  @ApiProperty({
    example: 1006,
  })
  defindex!: number;

  @ApiProperty({
    example: 'halloween_voice_modulation',
    required: false,
  })
  attribute_class?: string;

  @ApiProperty({
    example: 'Voices from Below',
    required: false,
  })
  description_string?: string;

  @ApiProperty({
    example: 'value_is_additive',
    required: false,
  })
  description_format?: string;

  @ApiProperty({
    example: 'positive',
  })
  effect_type!: string;

  @ApiProperty({
    example: false,
  })
  hidden!: boolean;

  @ApiProperty({
    example: false,
  })
  stored_as_integer!: boolean;
}

export class SchemaQueryDto {
  @IsUrl()
  itemsGameUrl: string;
}
