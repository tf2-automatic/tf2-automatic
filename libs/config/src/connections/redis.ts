import Joi from 'joi';
import { getEnv } from '../helpers';

export interface Config {
  type: 'redis';
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  persist: boolean;
}

export function getConfig(): Config {
  return {
    type: 'redis',
    host: getEnv('REDIS_HOST', 'string')!,
    port: getEnv('REDIS_PORT', 'integer')!,
    password: getEnv('REDIS_PASSWORD', 'string'),
    db: getEnv('REDIS_DB', 'integer'),
    keyPrefix: getEnv('REDIS_KEY_PREFIX', 'string'),
    persist: getEnv('REDIS_PERSIST', 'boolean'),
  };
}

export function getRules() {
  return {
    REDIS_HOST: Joi.string().required(),
    REDIS_PORT: Joi.number().integer().positive().required(),
    REDIS_PASSWORD: Joi.string().optional(),
    REDIS_DB: Joi.number().integer().optional(),
    REDIS_KEY_PREFIX: Joi.string().optional(),
    REDIS_PERSIST: Joi.boolean().optional(),
  };
}
