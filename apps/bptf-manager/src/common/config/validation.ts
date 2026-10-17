import { getLockRules, Redis } from '@tf2-automatic/config';
import * as Joi from 'joi';

const validation = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().required(),
  ...Redis.getRules(),
  ...getLockRules(),
  AGENTS_REGISTER_INTERVAL: Joi.number().positive().optional().min(60000),
  ...[
    'LISTINGS_BATCH',
    'ARCHIVED_LISTINGS_BATCH',
    'LISTINGS_GET',
    'ARCHIVED_LISTINGS_GET',
    'NOTIFICATIONS_GET',
  ].reduce(
    (rules, prefix) => ({
      ...rules,
      [`${prefix}_RATE_LIMIT_REQUESTS`]: Joi.number()
        .integer()
        .positive()
        .optional(),
      [`${prefix}_RATE_LIMIT_WINDOW`]: Joi.number()
        .integer()
        .positive()
        .optional(),
    }),
    {},
  ),
});

export { validation };
