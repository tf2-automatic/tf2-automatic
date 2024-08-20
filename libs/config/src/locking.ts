import Joi from 'joi';
import { getEnvWithDefault } from './helpers';

export interface LockConfig {
  driftFactor: number;
  retryCount: number;
  retryDelay: number;
  retryJitter: number;
  automaticExtensionThreshold: number;
}

export function getLockConfig(): LockConfig {
  return {
    driftFactor: getEnvWithDefault('LOCK_DRIFT_FACTOR', 'float', 0.01),
    retryCount: getEnvWithDefault('LOCK_RETRY_COUNT', 'integer', 10),
    retryDelay: getEnvWithDefault('LOCK_RETRY_DELAY', 'integer', 200),
    retryJitter: getEnvWithDefault('LOCK_RETRY_JITTER', 'integer', 100),
    automaticExtensionThreshold: getEnvWithDefault(
      'LOCK_AUTOMATIC_EXTENSION_THRESHOLD',
      'integer',
      500,
    ),
  };
}

export function getLockRules() {
  return {
    LOCK_DRIFT_FACTOR: Joi.number().optional(),
    LOCK_RETRY_COUNT: Joi.number().integer().optional(),
    LOCK_RETRY_DELAY: Joi.number().integer().optional(),
    LOCK_RETRY_JITTER: Joi.number().integer().optional(),
    LOCK_AUTOMATIC_EXTENSION_THRESHOLD: Joi.number().integer().optional(),
  };
}
