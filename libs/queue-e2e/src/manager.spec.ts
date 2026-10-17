import { Job, Queue, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import {
  bullWorkerSettings,
  defaultJobOptions,
  JobData,
  QueueManager,
} from '@tf2-automatic/queue';

// Started by docker-compose.yaml
const connection = { host: 'localhost', port: 6379 };

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

    // Expire the delay right before it is changed
    const changeDelay = Job.prototype.changeDelay;
    const spy = jest
      .spyOn(Job.prototype, 'changeDelay')
      .mockImplementation(async function (this: Job, delay: number) {
        await this.promote();
        return changeDelay.call(this, delay);
      });

    try {
      await expect(addJob(2)).resolves.toBeDefined();
    } finally {
      spy.mockRestore();
    }

    expect(await jobs()).toHaveLength(1);
  });

  it('adds the job again when it is removed mid-update', async () => {
    await addJob(1, 60000);

    // Remove the job right before its data is updated, like a completed job
    const updateData = Job.prototype.updateData;
    const spy = jest
      .spyOn(Job.prototype, 'updateData')
      .mockImplementation(async function (this: Job, data: unknown) {
        await this.remove();
        return updateData.call(this, data);
      });

    try {
      await expect(addJob(2)).resolves.toBeDefined();
    } finally {
      spy.mockRestore();
    }

    const added = await jobs();
    expect(added).toHaveLength(1);
    expect(added[0].data.options).toEqual({ value: 2 });
  });

  it('throws other errors from updating the job', async () => {
    await addJob(1, 60000);

    const spy = jest
      .spyOn(Job.prototype, 'updateData')
      .mockRejectedValue(new Error('Connection is closed.'));

    try {
      await expect(addJob(2)).rejects.toThrow('Connection is closed.');
    } finally {
      spy.mockRestore();
    }

    const added = await jobs();
    expect(added).toHaveLength(1);
    expect(added[0].data.options).toEqual({ value: 1 });
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

  it('keeps the delay but updates the data when added with a shorter delay', async () => {
    const existing = await addJob(1, 60000);
    await addJob(2, 1000);

    const job = await manager.getJobById('job');
    expect(job?.id).toBe(existing.id);
    expect(job?.data.options).toEqual({ value: 2 });
    expect(job?.delay).toBe(60000);
    expect(await jobs()).toHaveLength(1);
  });

  it('updates the data of a waiting job', async () => {
    const existing = await addJob(1);
    const job = await addJob(2);

    expect(job.id).toBe(existing.id);
    expect((await manager.getJobById('job'))?.data.options).toEqual({
      value: 2,
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
    expect((await manager.getJobById('job'))?.data.options).toEqual({
      value: 1,
    });

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
