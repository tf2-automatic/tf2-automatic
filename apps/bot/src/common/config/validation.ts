import { getEventRules } from '@tf2-automatic/config';
import Joi from 'joi';

const whenStorageTypeS3 = {
  is: 's3',
  then: Joi.required(),
};

const whenStorageTypeLocal = {
  is: 'local',
  then: Joi.required(),
};

const whenManager = {
  is: true,
  then: Joi.required(),
};

const whenManagerOptional = {
  is: true,
  then: Joi.optional(),
};

const validation = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().port().required(),
  IP_ADDRESS: Joi.string().ip().optional(),
  STEAM_USERNAME: Joi.string().required(),
  STEAM_PASSWORD: Joi.string().required(),
  STEAM_SHARED_SECRET: Joi.string().required(),
  STEAM_IDENTITY_SECRET: Joi.string().required(),
  STEAM_API_KEY: Joi.string().optional(),
  STEAM_PROXY_URL: Joi.string()
    .uri({
      scheme: ['http'],
    })
    .optional(),
  TRADE_CANCEL_TIME: Joi.number().integer().positive().optional(),
  TRADE_PENDING_CANCEL_TIME: Joi.number().integer().positive().optional(),
  TRADE_POLL_INTERVAL: Joi.number().integer().allow(-1).positive().optional(),
  TRADE_POLL_FULL_UPDATE_INTERVAL: Joi.number().positive().optional(),
  ...getEventRules(),
  DEBUG: Joi.boolean().optional(),
  STORAGE_TYPE: Joi.string().valid('local', 's3').required(),
  STORAGE_LOCAL_PATH: Joi.string().when('STORAGE_TYPE', whenStorageTypeLocal),
  STORAGE_S3_ENDPOINT: Joi.string().when('STORAGE_TYPE', whenStorageTypeS3),
  STORAGE_S3_PORT: Joi.number().when('STORAGE_TYPE', whenStorageTypeS3),
  STORAGE_S3_USE_SSL: Joi.boolean().when('STORAGE_TYPE', whenStorageTypeS3),
  STORAGE_S3_PATH: Joi.string().when('STORAGE_TYPE', whenStorageTypeS3),
  STORAGE_S3_ACCESS_KEY_ID: Joi.string().when(
    'STORAGE_TYPE',
    whenStorageTypeS3,
  ),
  STORAGE_S3_SECRET_ACCESS_KEY: Joi.string().when(
    'STORAGE_TYPE',
    whenStorageTypeS3,
  ),
  STORAGE_S3_BUCKET: Joi.string().when('STORAGE_TYPE', whenStorageTypeS3),
  BOT_MANAGER_ENABLED: Joi.boolean().optional(),
  BOT_MANAGER_URL: Joi.string()
    .uri({
      scheme: ['http', 'https'],
    })
    .when('BOT_MANAGER_ENABLED', whenManager),
  BOT_MANAGER_HEARTBEAT_INTERVAL: Joi.number()
    .positive()
    .integer()
    .max(60000)
    .min(1000)
    .when('BOT_MANAGER_ENABLED', whenManagerOptional),
});

export { validation };
