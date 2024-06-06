import { Redis } from 'ioredis';
import { BOT_EXCHANGE_NAME, BaseEvent } from '@tf2-automatic/bot-data';

const subscriber = new Redis();
const redis = new Redis();

let reading = false;

subscriber.subscribe(BOT_EXCHANGE_NAME);

subscriber.on('message', (channel) => {
  if (channel === BOT_EXCHANGE_NAME) {
    read();
  }
});

redis.on('connect', () => {
  read();
});

function read() {
  if (reading) {
    return;
  }

  reading = true;

  let repeat = false;

  getAndHandleMessage().then((hasMessage) => {
    if (hasMessage) {
      repeat = true;
    }
  }).finally(() => {
    reading = false;

    if (repeat) {
      read();
    } else {
      // Wait for 1 second before retrying
      setTimeout(read, 1000);
    }
  });
}

async function getAndHandleMessage(): Promise<boolean> {
  const message = await redis.lindex(BOT_EXCHANGE_NAME, -1);
  if (!message) {
    return false;
  }

  const event = JSON.parse(message) as BaseEvent<unknown>;

  // Handle event
  handleEvent(event);

  // Remove message from list once handled
  await redis.lrem(BOT_EXCHANGE_NAME, 1, message);

  return true;
}

function handleEvent(event: BaseEvent<unknown>) {
  console.log(event);
}