import { getEventRules, getLockRules, Redis } from '@tf2-automatic/config';
import * as Joi from 'joi';

const validation = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().required(),
  ...Redis.getRules(),
  ...getLockRules(),
  ...getEventRules(['rabbitmq']),
  BOT_MANAGER_URL: Joi.string().required(),
  SCHEMA_UPDATE_TIMEOUT: Joi.number().integer().min(0).optional(),
  SCHEMA_LIMITER_DURATION: Joi.number().integer().min(0).optional(),
});

export { validation };
