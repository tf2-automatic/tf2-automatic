import * as helpers from './helpers';

describe('Helpers', () => {
  it('should return the environment variable', () => {
    process.env['TEST'] = 'test';

    const result = helpers.getEnv('TEST', 'string');

    expect(result).toBe('test');
  });

  it('should return the environment variable as a float', () => {
    process.env['TEST'] = '3.14';

    const result = helpers.getEnv('TEST', 'float');

    expect(result).toBe(3.14);
  });

  it('should return the environment variable as an integer', () => {
    process.env['TEST'] = '42';

    const result = helpers.getEnv('TEST', 'integer');

    expect(result).toBe(42);
  });

  it('should return the environment variable as a boolean', () => {
    process.env['TEST'] = 'true';

    const result = helpers.getEnv('TEST', 'boolean');

    expect(result).toBe(true);
  });

  it('should throw an error if the type is invalid', () => {
    // @ts-expect-error Testing invalid input
    expect(() => helpers.getEnv('TEST', 'invalid')).toThrow();
  });
});
