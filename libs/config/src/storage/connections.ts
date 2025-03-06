import Joi from 'joi';
import { getEnv } from '../helpers';

export type StorageConfig = S3StorageConfig | LocalStorageConfig;

interface BaseConfig {
  type: unknown;
  directory: string;
}

export interface S3StorageConfig extends BaseConfig {
  type: 's3';
  endpoint: string;
  port: number;
  useSSL: boolean;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface LocalStorageConfig extends BaseConfig {
  type: 'local';
}

export function getLocalStorageConfig(): LocalStorageConfig {
  return {
    type: 'local',
    directory: getEnv('STORAGE_LOCAL_PATH', 'string')!,
  };
}

export function getS3StorageConfig(): S3StorageConfig {
  return {
    type: 's3',
    directory: getEnv('STORAGE_S3_PATH', 'string')!,
    endpoint: getEnv('STORAGE_S3_ENDPOINT', 'string')!,
    port: getEnv('STORAGE_S3_PORT', 'integer')!,
    useSSL: getEnv('STORAGE_S3_USE_SSL', 'boolean'),
    bucket: getEnv('STORAGE_S3_BUCKET', 'string')!,
    accessKeyId: getEnv('STORAGE_S3_ACCESS_KEY_ID', 'string')!,
    secretAccessKey: getEnv('STORAGE_S3_SECRET_ACCESS_KEY', 'string')!,
  };
}

export function getLocalStorageConfigRules() {
  return {
    STORAGE_LOCAL_PATH: Joi.string().required(),
  };
}

export function getS3StorageConfigRules() {
  return {
    STORAGE_S3_ENDPOINT: Joi.string().required(),
    STORAGE_S3_PORT: Joi.number().integer().positive().required(),
    STORAGE_S3_USE_SSL: Joi.boolean().required(),
    STORAGE_S3_BUCKET: Joi.string().required(),
    STORAGE_S3_PATH: Joi.string().required(),
    STORAGE_S3_ACCESS_KEY_ID: Joi.string().required(),
    STORAGE_S3_SECRET_ACCESS_KEY: Joi.string().required(),
  };
}
