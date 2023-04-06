import { ApiProperty } from '@nestjs/swagger';
import { RetryOptions } from '@tf2-automatic/bot-manager-data';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class QueueRetryDto implements RetryOptions {
  @ApiProperty({
    description: 'The retry strategy to use',
    required: false,
    example: 'exponential',
  })
  @IsOptional()
  @IsEnum(['exponential', 'linear', 'fixed'])
  strategy?: 'exponential' | 'linear' | 'fixed';

  @ApiProperty({
    description:
      'Maximum amount of time in milliseconds the job will be retried for until it fails',
    example: 60000,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(10000)
  maxTime?: number;

  @ApiProperty({
    description: 'Delay between retries in milliseconds',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1000)
  delay?: number;

  @ApiProperty({
    description: 'Maximum delay between retries in milliseconds',
    example: 10000,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(10000)
  maxDelay?: number;
}
