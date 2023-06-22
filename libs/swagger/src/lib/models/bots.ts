import { Bot } from '@tf2-automatic/bot-manager-data';
import { ApiProperty } from '@nestjs/swagger';

export class BotModel implements Bot {
  @ApiProperty({
    example: '76561198120070906',
    description: 'The SteamID64 of the bot',
  })
  steamid64: string;

  @ApiProperty({
    example: 'x.x.x.x',
    description: 'The IP address of the bot',
  })
  ip: string;

  @ApiProperty({
    example: 12345,
    description: 'The port of the bot',
  })
  port: number;

  @ApiProperty({
    example: 60000,
    description:
      'The interval the bot is sending the heartbeat in milliseconds',
  })
  interval: number;

  @ApiProperty({
    example: Math.floor(Date.now() / 1000),
    description: 'The last time the bot sent a heartbeat',
  })
  lastSeen: number;
}
