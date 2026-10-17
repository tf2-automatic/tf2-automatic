import { NotFoundException } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { AsyncLocalStorage } from 'async_hooks';
import { ClsService } from 'nestjs-cls';
import { RegisterAgentsProcessor } from './register-agents.processor';

describe('RegisterAgentsProcessor', () => {
  it('does not retry when the account has no token', async () => {
    const agentsService = {
      getAgent: jest.fn().mockResolvedValue({ userAgent: null }),
      registerAgent: jest.fn(),
    };
    const tokensService = {
      getToken: jest
        .fn()
        .mockRejectedValue(new NotFoundException('Token not found')),
    };

    const processor = new RegisterAgentsProcessor(
      agentsService as never,
      tokensService as never,
      new ClsService(new AsyncLocalStorage()),
    );

    await expect(
      processor.process({
        data: { steamid64: '76561198120070906' },
        attemptsMade: 0,
      } as Job),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(agentsService.registerAgent).not.toHaveBeenCalled();
  });
});
