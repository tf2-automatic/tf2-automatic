import { Redis, getEventRules } from '@tf2-automatic/config';
import Joi from 'joi';

const rules = {
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().required(),
  ...getEventRules(),
  ...Redis.getRules(),
  LEADER_TIMEOUT: Joi.number().integer().optional().min(1000),
  LEADER_RENEW_TIMEOUT: Joi.number().integer().optional().min(2000),
};

const validation = Joi.object(rules);

export { validation };
