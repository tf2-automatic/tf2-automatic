import { Job, Queue, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import { bullWorkerSettings } from './backoff-strategy';
import { defaultJobOptions } from './job-options';
import { QueueManager } from './manager';
import { JobData } from './types';

// Requires a real Redis, the queue logic runs in BullMQ's Lua scripts.
const url = new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
const connection = { host: url.hostname, port: Number(url.port || 6379) };

const cls = { has: () => false } as unknown as ClsService;

type Params = { value: number };

describe('QueueManager.addJob', () => {
  let queue: Queue;
  let manager: QueueManager<Params, JobData<Params>>;
  let worker: Worker | undefined;

  beforeEach(() => {
    queue = new Queue('manager-spec-' + randomUUID(), {
      connection,
      defaultJobOptions,
    });
    manager = new QueueManager(queue, cls);
  });

  afterEach(async () => {
    await worker?.close(true);
    worker = undefined;
    await queue.obliterate({ force: true });
    await queue.close();
  });

  const addJob = (value: number, delay?: number) =>
    manager.addJob('job', 'load', { value }, { delay });

  const jobs = () => queue.getJobs(['delayed', 'waiting', 'active']);

  it('does not throw when the job leaves the delayed state mid-update', async () => {
    await addJob(1, 60000);

    // Simulate a worker promoting the job right after it was checked
    const isDelayed = jest
      .spyOn(Job.prototype, 'isDelayed')
      .mockImplementation(async function (this: Job) {
        await this.promote();
        return true;
      });

    try {
      await expect(addJob(2)).resolves.toBeDefined();
    } finally {
      isDelayed.mockRestore();
    }

    expect(await jobs()).toHaveLength(1);
  });

  it('does not throw when added concurrently while the delay expires', async () => {
    worker = new Worker(queue.name, async () => undefined, {
      connection,
      autorun: true,
    });

    for (let i = 0; i < 20; i++) {
      await addJob(i, 5);
      await Promise.all(
        Array.from({ length: 10 }, (_, j) => addJob(j, j % 2 === 0 ? 0 : 5)),
      );
    }
  });

  it('adds a job when none exists', async () => {
    const job = await addJob(1);

    expect(job.id).toBe('job');
    expect((await manager.getJobById('job'))?.id).toBe('job');
    expect((await manager.getJobs(1, 10)).data.map((j) => j.id)).toEqual([
      'job',
    ]);
    expect(job.data.options).toEqual({ value: 1 });
  });

  it('runs a delayed job now when added without a delay', async () => {
    await addJob(1, 60000);
    await addJob(2);

    const job = await manager.getJobById('job');
    expect(job?.data.options).toEqual({ value: 2 });
    expect(job?.delay).toBe(0);
    expect(await jobs()).toHaveLength(1);
  });

  it('postpones a delayed job when added with a longer delay', async () => {
    await addJob(1, 1000);
    await addJob(2, 60000);

    const job = await manager.getJobById('job');
    expect(job?.data.options).toEqual({ value: 2 });
    expect(job?.delay).toBe(60000);
    expect(await jobs()).toHaveLength(1);
  });

  it('keeps a delayed job when added with a shorter delay', async () => {
    const existing = await addJob(1, 60000);
    await addJob(2, 1000);

    const job = await manager.getJobById('job');
    expect(job?.id).toBe(existing.id);
    expect(job?.data.options).toEqual({ value: 1 });
    expect(job?.delay).toBe(60000);
    expect(await jobs()).toHaveLength(1);
  });

  it('keeps a waiting job', async () => {
    const existing = await addJob(1);
    const job = await addJob(2);

    expect(job.id).toBe(existing.id);
    expect((await manager.getJobById('job'))?.data.options).toEqual({
      value: 1,
    });
    expect(await jobs()).toHaveLength(1);
  });

  it('keeps an active job and does not queue another', async () => {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let started!: () => void;
    const active = new Promise<void>((resolve) => (started = resolve));

    worker = new Worker(
      queue.name,
      async () => {
        started();
        await released;
      },
      { connection },
    );

    const existing = await addJob(1);
    await active;

    const job = await addJob(2);
    expect(job.id).toBe(existing.id);

    const completed = new Promise<void>((resolve) =>
      worker?.once('completed', () => resolve()),
    );
    release();
    await completed;

    expect(await jobs()).toHaveLength(0);
  });

  it('keeps attempts and creation time when re-adding a retrying job', async () => {
    const failing = new Worker(
      queue.name,
      async (): Promise<void> => {
        throw new Error('fail');
      },
      { connection, settings: bullWorkerSettings },
    );
    worker = failing;
    const failed = new Promise<void>((resolve) =>
      failing.once('failed', () => resolve()),
    );

    const added = await addJob(1);
    await failed;
    await failing.close();
    worker = undefined;

    const retrying = await manager.getJobById('job');
    expect(await retrying?.getState()).toBe('delayed');
    expect(retrying?.attemptsMade).toBe(1);

    await addJob(2, 60000);

    const job = await manager.getJobById('job');
    expect(job?.attemptsMade).toBe(1);
    expect(job?.timestamp).toBe(added.timestamp);
    expect(job?.data.options).toEqual({ value: 2 });
  });

  it('removes a job by the id passed to addJob', async () => {
    await addJob(1, 60000);

    expect(await manager.removeJobById('job')).toBe(true);
    expect(await manager.getJobById('job')).toBeNull();
    expect(await jobs()).toHaveLength(0);
  });
});
