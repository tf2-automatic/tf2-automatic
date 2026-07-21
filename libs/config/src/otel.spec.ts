import Joi from 'joi';
import { getOtelConfig, getOtelConfigRules } from './otel';

describe('otel config', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    // Ensure getAppNameAndVersion() short-circuits to null.
    process.env['NODE_ENV'] = 'test';
    delete process.env['OTEL_ENABLED'];
    delete process.env['OTEL_LOGS_ENABLED'];
    delete process.env['OTEL_TRACES_ENABLED'];
    delete process.env['OTEL_METRICS_ENABLED'];
    delete process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    delete process.env['OTEL_EXPORTER_OTLP_HEADERS'];
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('getOtelConfig', () => {
    test('is disabled by default', () => {
      const config = getOtelConfig();
      expect(config.enabled).toBe(false);
      expect(config.logs.enabled).toBe(false);
      expect(config.traces.enabled).toBe(false);
      expect(config.metrics.enabled).toBe(false);
      expect(config.endpoint).toBe('http://localhost:4318');
      expect(config.protocol).toBe('http/protobuf');
    });

    test('enables logs and metrics by default when the master switch is on', () => {
      process.env['OTEL_ENABLED'] = 'true';
      const config = getOtelConfig();
      expect(config.enabled).toBe(true);
      expect(config.logs.enabled).toBe(true);
      expect(config.metrics.enabled).toBe(true);
      expect(config.traces.enabled).toBe(false);
    });

    test('keeps every signal off when the master switch is off, even if a signal is set', () => {
      process.env['OTEL_TRACES_ENABLED'] = 'true';
      process.env['OTEL_METRICS_ENABLED'] = 'true';
      const config = getOtelConfig();
      expect(config.enabled).toBe(false);
      expect(config.traces.enabled).toBe(false);
      expect(config.metrics.enabled).toBe(false);
    });

    test('metrics can be explicitly disabled while OpenTelemetry is enabled', () => {
      process.env['OTEL_ENABLED'] = 'true';
      process.env['OTEL_METRICS_ENABLED'] = 'false';
      expect(getOtelConfig().metrics.enabled).toBe(false);
    });

    test('enables traces and metrics when explicitly turned on', () => {
      process.env['OTEL_ENABLED'] = 'true';
      process.env['OTEL_TRACES_ENABLED'] = 'true';
      process.env['OTEL_METRICS_ENABLED'] = 'true';
      const config = getOtelConfig();
      expect(config.traces.enabled).toBe(true);
      expect(config.metrics.enabled).toBe(true);
    });

    test('parses OTLP headers', () => {
      process.env['OTEL_ENABLED'] = 'true';
      process.env['OTEL_EXPORTER_OTLP_HEADERS'] =
        'authorization=Bearer abc,x-tenant=42';
      const config = getOtelConfig();
      expect(config.headers).toEqual({
        authorization: 'Bearer abc',
        'x-tenant': '42',
      });
    });

    test('leaves headers undefined when not set', () => {
      process.env['OTEL_ENABLED'] = 'true';
      expect(getOtelConfig().headers).toBeUndefined();
    });
  });

  describe('getOtelConfigRules', () => {
    const schema = Joi.object(getOtelConfigRules());

    test('accepts an empty environment', () => {
      expect(schema.validate({}).error).toBeUndefined();
    });

    test('accepts a valid configuration', () => {
      const { error } = schema.validate({
        OTEL_ENABLED: true,
        OTEL_EXPORTER_OTLP_ENDPOINT: 'https://collector:4318',
        OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
        OTEL_TRACES_SAMPLER_ARG: 0.5,
      });
      expect(error).toBeUndefined();
    });

    test('rejects an invalid protocol', () => {
      const { error } = schema.validate({
        OTEL_EXPORTER_OTLP_PROTOCOL: 'grpc',
      });
      expect(error).toBeDefined();
    });

    test('rejects a non-uri endpoint', () => {
      const { error } = schema.validate({
        OTEL_EXPORTER_OTLP_ENDPOINT: 'not-a-uri',
      });
      expect(error).toBeDefined();
    });

    test('rejects a sampler arg outside [0, 1]', () => {
      expect(
        schema.validate({ OTEL_TRACES_SAMPLER_ARG: 2 }).error,
      ).toBeDefined();
    });
  });
});
