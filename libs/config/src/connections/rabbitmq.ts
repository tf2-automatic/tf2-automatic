import Joi from 'joi';
import { getEnv } from '../helpers';

export interface Config {
  type: 'rabbitmq';
  host: string;
  port: number;
  username: string;
  password: string;
  vhost: string;
}

export function getConfig(): Config {
  return {
    type: 'rabbitmq',
    host: getEnv('RABBITMQ_HOST', 'string')!,
    port: getEnv('RABBITMQ_PORT', 'integer')!,
    username: getEnv('RABBITMQ_USERNAME', 'string')!,
    password: getEnv('RABBITMQ_PASSWORD', 'string')!,
    vhost: getEnv('RABBITMQ_VHOST', 'string')!,
  };
}

export function getRules() {
  return {
    RABBITMQ_HOST: Joi.string().required(),
    RABBITMQ_PORT: Joi.number().integer().positive().required(),
    RABBITMQ_USERNAME: Joi.string().required(),
    RABBITMQ_PASSWORD: Joi.string().required(),
    RABBITMQ_VHOST: Joi.string().allow('').required(),
  };
}
