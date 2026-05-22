import { Bot } from '@tf2-automatic/bot-manager-data';

export function getBotUrl(bot: Bot) {
  return `http://${bot.host}:${bot.port}`;
}
