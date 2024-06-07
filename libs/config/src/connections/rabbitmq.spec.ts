import { getConfig } from './rabbitmq';

describe('RabbitMQ', () => {
  afterEach(() => {
    delete process.env['RABBITMQ_HOST'];
    delete process.env['RABBITMQ_PORT'];
    delete process.env['RABBITMQ_USERNAME'];
    delete process.env['RABBITMQ_PASSWORD'];
    delete process.env['RABBITMQ_VHOST'];
  });

  it('should return the proper configuration', () => {
    process.env['RABBITMQ_HOST'] = 'localhost';
    process.env['RABBITMQ_PORT'] = '5672';
    process.env['RABBITMQ_USERNAME'] = 'test';
    process.env['RABBITMQ_PASSWORD'] = 'test';
    process.env['RABBITMQ_VHOST'] = '';

    const config = getConfig();

    expect(config).toEqual({
      type: 'rabbitmq',
      host: 'localhost',
      port: 5672,
      username: 'test',
      password: 'test',
      vhost: '',
    });
  });
});
