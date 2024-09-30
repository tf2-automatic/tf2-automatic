import { ApiProperty } from '@nestjs/swagger';

export * from './items';

export interface UpdateSchemaResponse {
  enqueued: boolean;
}

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
