import * as Joi from 'joi';

const validation = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().integer().required(),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_DB: Joi.number().positive().optional(),
});

export { validation };
