import * as Joi from 'joi';

const whenS3 = {
  is: 's3',
  then: Joi.required(),
};

const whenLocal = {
  is: 'local',
  then: Joi.required(),
};

const whenManager = {
  is: true,
  then: Joi.required(),
};

const validation = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().port().required(),
  IP_ADDRESS: Joi.string().ip().optional(),
  STEAM_USERNAME: Joi.string().required(),
  STEAM_PASSWORD: Joi.string().required(),
  STEAM_SHARED_SECRET: Joi.string().required(),
  STEAM_IDENTITY_SECRET: Joi.string().required(),
  STEAM_PROXY_URL: Joi.string()
    .uri({
      scheme: ['http'],
    })
    .optional(),
  TRADE_CANCEL_TIME: Joi.number().positive().optional(),
  TRADE_PENDING_CANCEL_TIME: Joi.number().positive().optional(),
  TRADE_POLL_INTERVAL: Joi.number().positive().optional(),
  RABBITMQ_HOST: Joi.string().required(),
  RABBITMQ_PORT: Joi.number().required(),
  RABBITMQ_USERNAME: Joi.string().required(),
  RABBITMQ_PASSWORD: Joi.string().required(),
  RABBITMQ_VHOST: Joi.string().allow('').required(),
  DEBUG: Joi.boolean().optional(),
  STORAGE_TYPE: Joi.string().valid('local', 's3').required(),
  STORAGE_LOCAL_PATH: Joi.string().when('STORAGE_TYPE', whenLocal),
  STORAGE_S3_ENDPOINT: Joi.string().when('STORAGE_TYPE', whenS3),
  STORAGE_S3_PORT: Joi.number().when('STORAGE_TYPE', whenS3),
  STORAGE_S3_USE_SSL: Joi.boolean().when('STORAGE_TYPE', whenS3),
  STORAGE_S3_PATH: Joi.string().when('STORAGE_TYPE', whenS3),
  STORAGE_S3_ACCESS_KEY_ID: Joi.string().when('STORAGE_TYPE', whenS3),
  STORAGE_S3_SECRET_ACCESS_KEY: Joi.string().when('STORAGE_TYPE', whenS3),
  STORAGE_S3_BUCKET: Joi.string().when('STORAGE_TYPE', whenS3),
  BOT_MANAGER_ENABLED: Joi.boolean().optional(),
  BOT_MANAGER_URL: Joi.string()
    .uri({
      scheme: ['http', 'https'],
    })
    .when('BOT_MANAGER_ENABLED', whenManager),
});

export { validation };
