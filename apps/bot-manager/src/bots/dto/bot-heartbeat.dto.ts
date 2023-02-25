import { BotHeartbeat } from '@tf2-automatic/bot-manager-data';
import { IsInt, IsIP } from 'class-validator';

export class BotHeartbeatDto implements BotHeartbeat {
  @IsIP(4)
  ip: string;

  @IsInt()
  port: number;
}
