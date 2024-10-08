import Joi from 'joi';
import { addWhen, getRequiredRules } from '../joi';
import { getEnv } from '../helpers';
import {
  getLocalStorageConfig,
  getLocalStorageConfigRules,
  getS3StorageConfig,
  getS3StorageConfigRules,
  StorageConfig,
} from './connections';

export type StorageConfigType = StorageConfig['type'];

function getType(): StorageConfigType {
  const type = getEnv('STORAGE_TYPE', 'string');
  if (type === 'local' || type === 's3') {
    return type satisfies StorageConfigType;
  }

  throw new Error('Missing or invalid storage type');
}

export function getStorageConfig(): StorageConfig {
  const type = getType();

  switch (type) {
    case 'local':
      return getLocalStorageConfig();
    case 's3':
      return getS3StorageConfig();
  }
}

function addRequiredWhenEvents(
  rules: Record<string, Joi.Schema>,
  is: StorageConfigType,
) {
  const required = getRequiredRules(rules);

  addWhen(rules, required, {
    ref: 'STORAGE_TYPE',
    options: {
      is: is,
      then: Joi.required(),
      otherwise: Joi.optional(),
    },
  });
}

export function getStorageConfigRules(types: StorageConfigType[] = []) {
  const local = getLocalStorageConfigRules();
  addRequiredWhenEvents(local, 'local');

  const s3 = getS3StorageConfigRules();
  addRequiredWhenEvents(s3, 's3');

  const rules = {
    STORAGE_TYPE: Joi.string()
      .valid(...types)
      .required(),
  };

  if (types.length === 0 || types.includes('local')) {
    Object.assign(rules, local);
  }

  if (types.length === 0 || types.includes('s3')) {
    Object.assign(rules, s3);
  }

  return rules;
}
