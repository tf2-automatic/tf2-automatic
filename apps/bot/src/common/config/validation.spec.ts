import { validation } from './validation';

describe('validation', () => {
  it('should work with a valid configuration', () => {
    expect(
      validation.validate({
        NODE_ENV: 'development',
        PORT: 3000,
        STEAM_USERNAME: 'username',
        STEAM_PASSWORD: 'password',
        STEAM_SHARED_SECRET: 'sharedSecret',
        STEAM_IDENTITY_SECRET: 'identitySecret',
        EVENTS_TYPE: 'rabbitmq',
        EVENTS_PERSIST: 'true',
        RABBITMQ_HOST: 'host',
        RABBITMQ_PORT: 5672,
        RABBITMQ_USERNAME: 'username',
        RABBITMQ_PASSWORD: 'password',
        RABBITMQ_VHOST: 'vhost',
        STORAGE_TYPE: 'local',
        STORAGE_LOCAL_PATH: './path',
      }).error,
    ).toBeUndefined();
  });

  it('should give error with an invalid configuration', () => {
    expect(
      validation.validate({
        NODE_ENV: 'development',
        PORT: 3000,
        STEAM_USERNAME: 'username',
        STEAM_PASSWORD: 'password',
        STEAM_SHARED_SECRET: 'sharedSecret',
        STEAM_IDENTITY_SECRET: 'identitySecret',
      }).error,
    ).toBeDefined();
  });
});
