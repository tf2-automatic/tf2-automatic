import { getLockRules, Redis } from '@tf2-automatic/config';
import * as Joi from 'joi';

const validation = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().required(),
  ...Redis.getRules(),
  ...getLockRules(),
  AGENTS_REGISTER_INTERVAL: Joi.number().positive().optional().min(60000),
  LISTINGS_RATE_LIMIT_REQUESTS: Joi.number().integer().positive().optional(),
  LISTINGS_RATE_LIMIT_WINDOW: Joi.number().integer().positive().optional(),
  ARCHIVED_LISTINGS_RATE_LIMIT_REQUESTS: Joi.number()
    .integer()
    .positive()
    .optional(),
  ARCHIVED_LISTINGS_RATE_LIMIT_WINDOW: Joi.number()
    .integer()
    .positive()
    .optional(),
});

export { validation };
