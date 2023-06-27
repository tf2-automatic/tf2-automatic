# Design

This section goes over the design of different parts of the system.

## Queues

Many different features depend on queueing, such as sending trades or loading inventories. Queues are used to retry actions to ensure that they are successfully made. The retry options for jobs are configurable and allow you to control how frequently, and for how long, retries may happen.

https://github.com/tf2-automatic/tf2-automatic/blob/f54cd7e6251be311aeea768bbde22d2e2c72d43b/libs/bot-manager-data/src/lib/misc.ts#L1C1-L6

The retry settings are shown above. Different retry strategies can be used, and different delays and timings can be used.

- strategy: Affects how the wait time is calculated when an attempt fails.
- maxTime: The maximum time that the job is allowed to be in the queue. If a job is older than max time then it will be removed.
- delay: The delay used as part of the retry strategy. It is the minimum delay between attempts.
- maxDelay: The maximum wait time between attempts.

Different queues for different actions might work differently but the retry options always work the same way.

## Caching

Caching is used to reduce the amount of requests sent to Steam and to decrease latency. Inventories and escrow responses are cached and set to expire after some time to prevent the data from becoming outdated.

## Transactional outbox

Transactional outbox is a pattern used to ensure that when data is updated, an event will also be made. The pattern is used for the data that is saved in Redis, such as inventories and bots.

The message-relay application is used to read the outbox and publish messages to RabbitMQ. It ensures that messages are published atleast once and because of this, it is important that all consumers are idempotent.

For more information, read about the pattern on [microservices.io](https://microservices.io/patterns/data/transactional-outbox.html).

## Ensuring offer state changes are published

It is very important that the system detects changes made to offers. This is used by consumers to, for example, know when a new offer is received, or an offer is accepted. The bot does not use transactional outbox like the bot-manager does, but it ensures the offers are published in a different way.

Offers are regularly fetched from Steam on a fixed interval, but they are also fetched when different actions are made, such as when an offer confirmation is accepted, or when the Steam client receives a notification about a new trade offer. When offers are fetched, they are added to an internal queue to ensure that their current state is published, and if a confirmation is pending then it is also published. Previously seen offers are also regularly added to the queue to ensure that their current state has been published.

Like for transactional outbox, changes are ensured to be published, but they may be published more than once.

## Heartbeats and liveliness

Bots send heartbeats to the bot-manager at fixed intervals. Heartbeats are used to keep track of active bots and remove the ones that no longer send heartbeats. When a heartbeat is made, a job is added to an internal queue that will run after a bot should have made a new heartbeat. When the job runs, it will check if the bot has made a new heartbeat. If it has not made a new heartbeat, then it will be removed from the bots list. Bots will also be removed from the list because of a ttl made in Redis, but they should be removed earlier by the bot-manager. Because of this the bots list should only contain active and responsive bots.

## Continue reading

Continue reading about the features of the system [here](features.md).
