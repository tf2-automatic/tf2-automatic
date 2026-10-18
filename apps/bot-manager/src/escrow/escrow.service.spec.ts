import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { HttpService } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bullmq';
import { HttpException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { pack } from 'msgpackr';
import SteamID from 'steamid';
import { EscrowService } from './escrow.service';

jest.mock('@tf2-automatic/queue', () => ({
  ...jest.requireActual('@tf2-automatic/queue'),
  QueueManagerWithEvents: jest.fn().mockImplementation(() => ({
    addJob: jest.fn().mockResolvedValue({ id: 'job' }),
    waitUntilFinished: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  })),
}));

describe('EscrowService', () => {
  const steamid = new SteamID('76561198000000000');
  const error = pack({
    statusCode: 400,
    message: 'Token is required when not friends with the user',
  });
  const success = {
    timestamp: Buffer.from('1'),
    result: pack({ escrowDays: 0 }),
  };

  let service: EscrowService;
  let hgetallBuffer: jest.Mock;
  let queueManager: { addJob: jest.Mock; waitUntilFinished: jest.Mock };

  beforeEach(async () => {
    hgetallBuffer = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        {
          provide: RedisService,
          useValue: {
            getOrThrow: () => ({
              ttl: jest.fn().mockResolvedValue(100),
              hgetallBuffer,
            }),
          },
        },
        { provide: HttpService, useValue: {} },
        { provide: getQueueToken('escrow'), useValue: {} },
        { provide: ClsService, useValue: {} },
      ],
    }).compile();

    service = module.get(EscrowService);
    queueManager = (service as unknown as { queueManager: typeof queueManager })
      .queueManager;
  });

  it('refetches a cached error when a token is supplied', async () => {
    hgetallBuffer
      .mockResolvedValueOnce({ error })
      .mockResolvedValueOnce(success);

    await expect(
      service.getEscrow(steamid, { token: 'abcdefgh' }),
    ).resolves.toMatchObject({ escrowDays: 0 });
    expect(queueManager.addJob).toHaveBeenCalledTimes(1);
  });

  it('rethrows a cached error when no token is supplied', async () => {
    hgetallBuffer.mockResolvedValue({ error });

    await expect(service.getEscrow(steamid, {})).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(queueManager.addJob).not.toHaveBeenCalled();
  });

  it('serves a cached result even when a token is supplied', async () => {
    hgetallBuffer.mockResolvedValue(success);

    await expect(
      service.getEscrow(steamid, { token: 'abcdefgh' }),
    ).resolves.toMatchObject({ escrowDays: 0 });
    expect(queueManager.addJob).not.toHaveBeenCalled();
  });
});
