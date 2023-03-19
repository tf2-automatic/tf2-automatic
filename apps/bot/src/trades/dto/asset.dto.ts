import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Asset as AssetInterface } from '@tf2-automatic/bot-data';
import { ApiProperty } from '@nestjs/swagger';

export class Asset implements AssetInterface {
  @ApiProperty({
    description: 'The assetid of the item',
    example: '1234567890',
  })
  @IsString()
  assetid: string;

  @ApiProperty({
    description: 'The appid of the item',
    example: 440,
  })
  @IsNumber()
  appid: number;

  @ApiProperty({
    description: 'The contextid of the item',
    example: '2',
  })
  @IsString()
  contextid: string;

  @ApiProperty({
    description: 'The amount of the item',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;
}
