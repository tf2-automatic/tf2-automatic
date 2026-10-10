import { initOpenTelemetry, shutdownOtel } from './sdk';

describe('sdk', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    process.env['NODE_ENV'] = 'test';
    delete process.env['OTEL_ENABLED'];
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('shutdownOtel resolves when the SDK was never started', async () => {
    await expect(shutdownOtel()).resolves.toBeUndefined();
  });

  test('initOpenTelemetry is a no-op when disabled and does not load the SDK', () => {
    expect(() => initOpenTelemetry()).not.toThrow();

    const loadedSdkNode = Object.keys(require.cache).some(
      (key) => key.includes('opentelemetry') && key.includes('sdk-node'),
    );
    expect(loadedSdkNode).toBe(false);
  });
});
