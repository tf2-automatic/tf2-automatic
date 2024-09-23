import Joi from 'joi';
import { getEnv, getEnvWithDefault } from '../helpers';
import fs from 'fs';
import path from 'path';

function getAppName(): string | null {
  if (process.env['NODE_ENV'] === 'test') {
    return null;
  }

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
  );

  return packageJson;
}

export interface Config {
  type: 'redis';
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix: string;
  persist: boolean;
}

export function getConfig(usePrefix = true): Config {
  const prefix = getAppName();

  return {
    type: 'redis',
    host: getEnv('REDIS_HOST', 'string')!,
    port: getEnv('REDIS_PORT', 'integer')!,
    password: getEnv('REDIS_PASSWORD', 'string'),
    db: getEnv('REDIS_DB', 'integer'),
    keyPrefix:
      getEnvWithDefault('REDIS_KEY_PREFIX', 'string', 'tf2-automatic') +
      ':' +
      (usePrefix && prefix ? prefix + ':' : ''),
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
