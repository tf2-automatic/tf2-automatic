import * as Joi from 'joi';

const whenS3 = {
  is: 's3',
  then: Joi.required(),
};

const whenLocal = {
  is: 'local',
  then: Joi.required(),
};

const validation = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().required(),
  STEAM_USERNAME: Joi.string().required(),
  STEAM_PASSWORD: Joi.string().required(),
  STEAM_SHARED_SECRET: Joi.string().required(),
  STEAM_IDENTITY_SECRET: Joi.string().required(),
  RABBITMQ_HOST: Joi.string().required(),
  RABBITMQ_PORT: Joi.number().required(),
  RABBITMQ_USERNAME: Joi.string().required(),
  RABBITMQ_PASSWORD: Joi.string().required(),
  RABBITMQ_VHOST: Joi.string().allow('').required(),
  RABBITMQ_PREFIX: Joi.string().optional().min(1),
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
});

export { validation };
