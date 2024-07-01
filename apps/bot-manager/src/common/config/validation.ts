import { Redis, getEventRules } from '@tf2-automatic/config';
import Joi from 'joi';

const rules = {
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().required(),
  ...getEventRules(),
  ...Redis.getRules(),
};

const validation = Joi.object(rules);

export { validation };
