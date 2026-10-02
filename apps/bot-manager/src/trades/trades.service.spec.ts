import { HttpService } from '@nestjs/axios';
import { ConflictException } from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Bot, QueueTradeJob } from '@tf2-automatic/bot-manager-data';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import { CustomJob, defaultJobOptions } from '@tf2-automatic/queue';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import { of } from 'rxjs';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';
import { TradesProcessor } from './trades.processor';
import { TradesService } from './trades.service';
import { TradeQueue } from './trades.types';

// Requires a real Redis, the queue logic runs in BullMQ's Lua scripts.
const url = new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
const connection = { host: url.hostname, port: Number(url.port || 6379) };

const bot: Bot = {
  steamid64: '76561198000000000',
  host: 'localhost',
  port: 3000,
  interval: 10000,
  version: null,
  running: true,
  lastSeen: 0,
};

const create: QueueTradeJob = {
  type: 'CREATE',
  data: {
    partner: '76561198000000001',
    itemsToGive: [],
    itemsToReceive: [],
  },
  bot: bot.steamid64,
};

const accept = (offerId: string): QueueTradeJob => ({
  type: 'ACCEPT',
  data: offerId,
  bot: bot.steamid64,
});

describe('TradesService jobs', () => {
  let redis: Redis;
  let queue: Queue<CustomJob<TradeQueue>>;
  let http: { post: jest.Mock; get: jest.Mock };
  let events: { publish: jest.Mock; subscribe: jest.Mock };
  let service: TradesService;
  let processor: TradesProcessor;

  beforeEach(() => {
    redis = new Redis({ ...connection, maxRetriesPerRequest: null });
    queue = new Queue('trades-spec-' + randomUUID(), {
      connection,
      defaultJobOptions,
    });
    http = {
      post: jest.fn(() => of({ data: { id: '1' } })),
      get: jest.fn(() => of({ data: { sent: [], received: [] } })),
    };
    events = {
      publish: jest.fn(() => Promise.resolve()),
      subscribe: jest.fn(),
    };
    const heartbeats = { getBot: jest.fn(() => Promise.resolve(bot)) };
    const cls = {
      has: () => false,
      enter: () => undefined,
      set: () => undefined,
    } as unknown as ClsService;

    service = new TradesService(
      http as unknown as HttpService,
      queue,
      { getOrThrow: () => redis } as unknown as RedisService,
      events as unknown as NestEventsService,
      heartbeats as unknown as HeartbeatsService,
      cls,
    );
    processor = new TradesProcessor(
      service,
      heartbeats as unknown as HeartbeatsService,
      events as unknown as NestEventsService,
      cls,
    );
  });

  afterEach(async () => {
    // TradesService does not close its queue events connection itself
    await (
      service as unknown as { queueManager: { close(): Promise<void> } }
    ).queueManager.close();
    await queue.obliterate({ force: true });
    await queue.close();
    redis.disconnect();
  });

  const onlyJob = async () => {
    const jobs = await queue.getJobs();
    expect(jobs).toHaveLength(1);
    return jobs[0];
  };

  it('returns trades_<uuid> as the id of a create job', async () => {
    const { id } = await service.addJob(create);

    expect(id).toMatch(/^trades_[0-9a-f-]{36}$/);
  });

  it('returns trades_<offerId> as the id of an offer job', async () => {
    expect(await service.addJob(accept('123'))).toEqual({ id: 'trades_123' });
  });

  it('rejects a second job for the same offer', async () => {
    await service.addJob(accept('123'));

    await expect(service.addJob(accept('123'))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('lists jobs by the id returned when they were added', async () => {
    const { id } = await service.addJob(accept('123'));

    const jobs = await service.getJobs();
    expect(jobs.data.map((job) => job.id)).toEqual([id]);
    expect(service.mapJob(await onlyJob()).id).toBe(id);
  });

  it('removes a job by the id returned when it was added', async () => {
    const { id } = await service.addJob(create);

    expect(await service.removeJob(id)).toBe(true);
    expect(await queue.getJobs()).toHaveLength(0);
    // BullMQ reports a missing job as removed
    expect(await service.removeJob(id)).toBe(true);
  });

  it('uses the returned id as idempotency key and event job id', async () => {
    const { id } = await service.addJob(create);

    await processor.processJob(await onlyJob());

    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post.mock.calls[0][2]).toEqual({
      headers: { 'X-Idempotency-Key': id },
    });
    expect(events.publish).toHaveBeenCalledTimes(1);
    expect(events.publish.mock.calls[0][1].job.id).toBe(id);
  });
});
