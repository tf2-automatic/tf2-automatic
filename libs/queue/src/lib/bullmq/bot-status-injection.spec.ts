import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { AsyncLocalStorage } from 'async_hooks';
import { BotStatus } from './offline-bots';
import { CustomWorkerHost } from './processor';

@Injectable()
class TestProcessor extends CustomWorkerHost<never> {
  constructor() {
    super(new ClsService(new AsyncLocalStorage()));
  }

  async processJob(): Promise<unknown> {
    return undefined;
  }
}

describe('CustomWorkerHost bot status injection', () => {
  it('injects the provided bot status into subclasses', async () => {
    const botStatus = { isBotOffline: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [TestProcessor, { provide: BotStatus, useValue: botStatus }],
    }).compile();

    expect(moduleRef.get(TestProcessor)).toHaveProperty('botStatus', botStatus);
  });

  it('works without a bot status', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [TestProcessor],
    }).compile();

    expect(moduleRef.get(TestProcessor)).not.toHaveProperty(
      'botStatus',
      expect.anything(),
    );
  });
});
