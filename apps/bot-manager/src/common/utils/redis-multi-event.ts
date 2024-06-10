import { BaseEvent } from '@tf2-automatic/bot-data';
import { BOT_MANAGER_EXCHANGE_NAME } from '@tf2-automatic/bot-manager-data';
import { EventsConfigType } from '@tf2-automatic/config';
import { OUTBOX_KEY } from '@tf2-automatic/transactional-outbox';
import { ChainableCommander } from 'ioredis';

export function redisMultiEvent(
  multi: ChainableCommander,
  event: BaseEvent<string>,
  type: EventsConfigType,
  persist: boolean,
): void {
  const eventString = JSON.stringify(event);

  if (type === 'redis') {
    if (persist) {
      multi.lpush(BOT_MANAGER_EXCHANGE_NAME, eventString);
    }
    multi.publish(BOT_MANAGER_EXCHANGE_NAME, eventString);
  } else if (type === 'rabbitmq') {
    // Add event to outbox
    multi
      .lpush(OUTBOX_KEY, eventString)
      // Publish that there is a new event
      .publish(OUTBOX_KEY, '');
  }
}
