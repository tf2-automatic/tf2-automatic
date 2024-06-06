import { Redis } from 'ioredis';
import { BOT_EXCHANGE_NAME } from '@tf2-automatic/bot-data';

const redis = new Redis();

redis.subscribe(BOT_EXCHANGE_NAME);

redis.on('message', (channel, message) => {
  if (channel === BOT_EXCHANGE_NAME) {
    const parsed = JSON.parse(message);
    console.log(parsed);
  }
});