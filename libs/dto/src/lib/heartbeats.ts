import { ApiProperty } from '@nestjs/swagger';
import { BotHeartbeat } from '@tf2-automatic/bot-manager-data';
import { IsInt, IsIP, Max, Min } from 'class-validator';

export class BotHeartbeatDto implements BotHeartbeat {
  @ApiProperty({
    example: 'x.x.x.x',
    description: 'The IP address the bot is sending the heartbeat from',
  })
  @IsIP(4)
  ip: string;

  @ApiProperty({
    example: 12345,
    description: 'The port the bot is listening to',
  })
  @IsInt()
  port: number;

  @ApiProperty({
    example: 60000,
    description:
      'The interval the bot is sending the heartbeat in milliseconds',
  })
  @IsInt()
  @Max(60000)
  @Min(1000)
  interval: number;
}
