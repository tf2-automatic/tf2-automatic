import Joi from 'joi';
import { getEnv, getEnvWithDefault } from './helpers';
import { getAppNameAndVersion } from './app';

export const DEFAULT_OTEL_ENDPOINT = 'http://localhost:4318';
export const DEFAULT_OTEL_PROTOCOL = 'http/protobuf';
export const DEFAULT_OTEL_METRIC_EXPORT_INTERVAL = 60000;
export const DEFAULT_OTEL_TRACES_SAMPLER_ARG = 1.0;

export type OtelProtocol = 'http/protobuf';

export interface OtelSignalConfig {
  enabled: boolean;
  endpoint?: string;
}

export interface OtelTracesConfig extends OtelSignalConfig {
  samplerArg: number;
}

export interface OtelMetricsConfig extends OtelSignalConfig {
  exportIntervalMillis: number;
}

export interface OtelConfig {
  enabled: boolean;
  serviceName?: string;
  serviceVersion?: string;
  endpoint: string;
  protocol: OtelProtocol;
  headers?: Record<string, string>;
  logs: OtelSignalConfig;
  traces: OtelTracesConfig;
  metrics: OtelMetricsConfig;
}

/**
 * Parse `OTEL_EXPORTER_OTLP_HEADERS` in the standard `k1=v1,k2=v2` format.
 */
function parseHeaders(): Record<string, string> | undefined {
  const raw = getEnv('OTEL_EXPORTER_OTLP_HEADERS', 'string');
  if (!raw) {
    return undefined;
  }

  const headers: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const index = pair.indexOf('=');
    if (index === -1) {
      continue;
    }
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) {
      headers[key] = value;
    }
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

/**
 * Reads the OpenTelemetry configuration directly from the environment.
 *
 * This is intentionally decoupled from Nest's `ConfigModule` because the SDK
 * has to be initialized before the Nest application (and its instrumented
 * dependencies) are loaded.
 *
 * When `OTEL_ENABLED` is not `true` the returned config is disabled and every
 * signal is off so callers can cheaply no-op.
 */
export function getOtelConfig(): OtelConfig {
  const enabled = getEnvWithDefault('OTEL_ENABLED', 'boolean', false);

  const app = getAppNameAndVersion();

  const endpoint = getEnvWithDefault(
    'OTEL_EXPORTER_OTLP_ENDPOINT',
    'string',
    DEFAULT_OTEL_ENDPOINT,
  );

  return {
    enabled,
    serviceName:
      getEnvWithDefault('OTEL_SERVICE_NAME', 'string', app?.name ?? '') ||
      undefined,
    serviceVersion: app?.version,
    endpoint,
    protocol: getEnvWithDefault(
      'OTEL_EXPORTER_OTLP_PROTOCOL',
      'string',
      DEFAULT_OTEL_PROTOCOL,
    ) as OtelProtocol,
    headers: parseHeaders(),
    logs: {
      // Logs are the primary signal, so they are on by default when enabled.
      enabled:
        enabled && getEnvWithDefault('OTEL_LOGS_ENABLED', 'boolean', true),
      endpoint: getEnv('OTEL_EXPORTER_OTLP_LOGS_ENDPOINT', 'string'),
    },
    traces: {
      enabled:
        enabled && getEnvWithDefault('OTEL_TRACES_ENABLED', 'boolean', false),
      endpoint: getEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', 'string'),
      samplerArg: getEnvWithDefault(
        'OTEL_TRACES_SAMPLER_ARG',
        'float',
        DEFAULT_OTEL_TRACES_SAMPLER_ARG,
      ),
    },
    metrics: {
      enabled:
        enabled && getEnvWithDefault('OTEL_METRICS_ENABLED', 'boolean', false),
      endpoint: getEnv('OTEL_EXPORTER_OTLP_METRICS_ENDPOINT', 'string'),
      exportIntervalMillis: getEnvWithDefault(
        'OTEL_METRIC_EXPORT_INTERVAL',
        'integer',
        DEFAULT_OTEL_METRIC_EXPORT_INTERVAL,
      ),
    },
  };
}

/**
 * Joi rules for the OpenTelemetry environment variables. Everything is optional
 * (the master switch defaults off and the endpoint has a default), so this is
 * type/format validation only.
 */
export function getOtelConfigRules(): Record<string, Joi.Schema> {
  const uri = () => Joi.string().uri({ scheme: ['http', 'https'] });

  return {
    OTEL_ENABLED: Joi.boolean().optional(),
    OTEL_SERVICE_NAME: Joi.string().optional(),
    OTEL_EXPORTER_OTLP_ENDPOINT: uri().optional(),
    OTEL_EXPORTER_OTLP_PROTOCOL: Joi.string().valid('http/protobuf').optional(),
    OTEL_EXPORTER_OTLP_HEADERS: Joi.string().optional(),
    OTEL_LOGS_ENABLED: Joi.boolean().optional(),
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: uri().optional(),
    OTEL_TRACES_ENABLED: Joi.boolean().optional(),
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: uri().optional(),
    OTEL_TRACES_SAMPLER_ARG: Joi.number().min(0).max(1).optional(),
    OTEL_METRICS_ENABLED: Joi.boolean().optional(),
    OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: uri().optional(),
    OTEL_METRIC_EXPORT_INTERVAL: Joi.number().integer().positive().optional(),
  };
}
