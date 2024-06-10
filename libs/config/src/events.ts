import Joi from 'joi';
import { addWhen, getRequiredRules } from './joi';
import { RabbitMQ, Redis } from './connections';
import { getEnv, getEnvWithDefault } from './helpers';

export type EventsConfig = (RabbitMQ.Config | Redis.Config) & {
  persist: boolean;
};

export type EventsConfigType = EventsConfig['type'];

function getType(): EventsConfigType {
  const type = getEnvWithDefault('EVENTS_TYPE', 'string', 'rabbitmq');
  if (type === 'rabbitmq' || type === 'redis') {
    return type;
  }

  throw new Error('Missing or invalid events type');
}

function getConnectionForEventsConfig() {
  const type = getType();

  switch (type) {
    case 'rabbitmq':
      return RabbitMQ.getConfig();
    case 'redis':
      return Redis.getConfig();
  }
}

export function getEventsConfig(): EventsConfig {
  return {
    ...getConnectionForEventsConfig(),
    persist: getEnv('EVENTS_PERSIST', 'boolean')!,
  };
}

export function addRequiredWhenEvents(
  rules: Record<string, Joi.Schema>,
  is: EventsConfigType,
) {
  const required = getRequiredRules(rules);
  addWhen(rules, required, {
    ref: 'EVENTS_TYPE',
    options: { is, then: Joi.required(), otherwise: Joi.optional() },
  });
}

export function getEventRules(types: EventsConfigType[] = []) {
  const rabbitmq = RabbitMQ.getRules();
  addRequiredWhenEvents(rabbitmq, 'rabbitmq');

  const redis = Redis.getRules();
  addRequiredWhenEvents(redis, 'redis');

  const rules = {
    EVENTS_TYPE: Joi.string()
      .valid(...types)
      .optional(),
    EVENTS_PERSIST: Joi.boolean().optional(),
  };

  if (types.length === 0 || types.includes('rabbitmq')) {
    Object.assign(rules, rabbitmq);
  }

  if (types.length === 0 || types.includes('redis')) {
    Object.assign(rules, redis);
  }

  return rules;
}
