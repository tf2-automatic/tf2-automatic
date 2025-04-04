import Joi from 'joi';
import { getEnv, getEnvWithDefault } from '../helpers';
import { CommonRedisOptions, SentinelConnectionOptions, StandaloneConnectionOptions } from 'ioredis';
import { addWhenToAll } from '../joi';
import { getAppNameAndVersion } from '../app';

type RedisType = 'standalone' | 'sentinel';
const DEFAULT_REDIS_TYPE: RedisType = 'standalone';

export type Config = CommonRedisOptions & (SentinelConnectionOptions | StandaloneConnectionOptions) & {
  type: 'redis';
  keyPrefix: string;
}

export function getConfig(usePrefix = true): Config {
  const app = getAppNameAndVersion();

  const password = getEnv('REDIS_PASSWORD', 'string');
  const keyPrefix = getEnvWithDefault('REDIS_KEY_PREFIX', 'string', 'tf2-automatic') +
  ':' +
  (usePrefix && app ? app.name + ':' : '');
  const db = getEnv('REDIS_DB', 'integer');

  const commonConfig = {
    db,
    keyPrefix,
  }

  const type = getEnvWithDefault('REDIS_TYPE', 'string', DEFAULT_REDIS_TYPE) as RedisType;

  if (type === 'sentinel') {
    const rawSentinels = getEnv('REDIS_SENTINELS', 'string')!;

    const sentinels: SentinelConnectionOptions["sentinels"] = rawSentinels.split(',').map((s) => {
      const url = new URL(s);
      return {
        host: url.hostname,
        port: parseInt(url.port)
      };
    });

    return {
      type: 'redis',
      ...commonConfig,
      sentinels,
      sentinelPassword: password,
      name: getEnv('REDIS_SENTINEL_NAME', 'string'),
    }
  }

  return {
    type: 'redis',
    ...commonConfig,
    host: getEnv('REDIS_HOST', 'string')!,
    port: getEnv('REDIS_PORT', 'integer')!,
    password,
  }
}

export function getRules() {
  const common = {
    REDIS_TYPE: Joi.string().valid('standalone', 'sentinel').optional(),
    REDIS_PASSWORD: Joi.string().optional(),
    REDIS_DB: Joi.number().integer().optional(),
    REDIS_KEY_PREFIX: Joi.string().optional(),
  };

  const sentinel = {
    REDIS_SENTINELS: Joi.string().required(),
    REDIS_SENTINEL_NAME: Joi.string().required(),
  };

  addWhenToAll(sentinel, {
    ref: 'REDIS_TYPE',
    options: {
      is: 'sentinel',
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    },
  })

  const standalone = {
    REDIS_HOST: Joi.string().required(),
    REDIS_PORT: Joi.number().integer().positive().required(),
  };

  addWhenToAll(standalone, {
    ref: 'REDIS_TYPE',
    options: {
      is: Joi.alt('standalone', Joi.not().exist()),
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    },
  });

  return {
    ...common,
    ...sentinel,
    ...standalone,
  };
}
