import { getLockRules, Redis } from '@tf2-automatic/config';
import * as Joi from 'joi';

const validation = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().required(),
  ...Redis.getRules(),
  ...getLockRules(),
  AGENTS_REGISTER_INTERVAL: Joi.number().positive().optional().min(60000),
});

export { validation };
