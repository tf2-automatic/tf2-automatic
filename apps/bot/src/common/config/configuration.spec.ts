import configuration from './configuration';

describe('configuration', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = {
      ...env,
      PORT: '3000',
      STEAM_USERNAME: 'username',
      STEAM_PASSWORD: 'password',
      STEAM_SHARED_SECRET: 'sharedSecret',
      STEAM_IDENTITY_SECRET: 'identitySecret',
      EVENTS_TYPE: 'rabbitmq',
      RABBITMQ_HOST: 'host',
      RABBITMQ_PORT: '5672',
      RABBITMQ_USERNAME: 'username',
      RABBITMQ_PASSWORD: 'password',
      RABBITMQ_VHOST: 'vhost',
      STORAGE_TYPE: 'local',
      STORAGE_LOCAL_PATH: './path',
    };
    delete process.env.TRADE_POLL_DATA_FORGET_TIME;
  });

  afterEach(() => {
    process.env = env;
  });

  it('defaults the poll data forget time to 14 days', () => {
    expect(configuration().trade.pollDataForgetTime).toBe(
      14 * 24 * 60 * 60 * 1000,
    );
  });
});
