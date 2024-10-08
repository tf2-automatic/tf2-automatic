import { getEventRules, getStorageConfigRules } from '@tf2-automatic/config';
import Joi from 'joi';

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
  WEB_SESSION_REFRESH_INTERVAL: Joi.number()
    .integer()
    .positive()
    .min(60000)
    .optional(),
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
  TRADE_POLL_DATA_FORGET_TIME: Joi.number().positive().optional(),
  ...getEventRules(),
  ...getStorageConfigRules(),
  DEBUG: Joi.boolean().optional(),
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
