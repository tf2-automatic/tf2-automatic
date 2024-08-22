import Joi from 'joi';
import { getEnvWithDefault } from './helpers';

export interface LockConfig {
  durationMultiplier: number;
  durationShort: number;
  durationMedium: number;
  durationLong: number;
  driftFactor: number;
  retryCount: number;
  retryDelay: number;
  retryJitter: number;
  automaticExtensionThreshold: number;
}

export function getLockConfig(): LockConfig {
  return {
    durationMultiplier: getEnvWithDefault('LOCK_DURATION_MULTIPLIER', 'integer', 1),
    durationShort: getEnvWithDefault('LOCK_DURATION_SHORT', 'integer', 2000),
    durationMedium: getEnvWithDefault('LOCK_DURATION_MEDIUM', 'integer', 5000),
    durationLong: getEnvWithDefault('LOCK_DURATION_LONG', 'integer', 10000),
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
    LOCK_DURATION_MULTIPLIER: Joi.number().integer().optional(),
    LOCK_DURATION_SHORT: Joi.number().integer().optional(),
    LOCK_DURATION_MEDIUM: Joi.number().integer().optional(),
    LOCK_DURATION_LONG: Joi.number().integer().optional(),
    LOCK_DRIFT_FACTOR: Joi.number().optional(),
    LOCK_RETRY_COUNT: Joi.number().integer().optional(),
    LOCK_RETRY_DELAY: Joi.number().integer().optional(),
    LOCK_RETRY_JITTER: Joi.number().integer().optional(),
    LOCK_AUTOMATIC_EXTENSION_THRESHOLD: Joi.number().integer().optional(),
  };
}
