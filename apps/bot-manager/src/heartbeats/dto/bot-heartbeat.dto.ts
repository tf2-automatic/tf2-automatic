import { ApiProperty } from '@nestjs/swagger';
import { BotHeartbeat } from '@tf2-automatic/bot-manager-data';
import { IsInt, IsIP } from 'class-validator';

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
}
