import { BaseEvent } from '@tf2-automatic/bot-data';
import { OUTBOX_KEY } from '@tf2-automatic/transactional-outbox';
import { ChainableCommander } from 'ioredis';

export function redisMultiEvent(
  multi: ChainableCommander,
  event: BaseEvent<string>,
): void {
  const eventString = JSON.stringify(event);

  // Add event to outbox
  multi
    .lpush(OUTBOX_KEY, eventString)
    // Publish that there is a new event
    .publish(OUTBOX_KEY, '');
}
