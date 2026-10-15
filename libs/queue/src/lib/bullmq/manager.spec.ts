import { Queue } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { QueueManager } from './manager';
import type { CustomJob, JobData } from './types';

type Params = { value: number };
type TestJobData = JobData<Params>;

const cls = { has: () => false } as unknown as ClsService;

function makeJob(changeDelay: () => Promise<void>) {
  return {
    id: 'job',
    timestamp: Date.now(),
    delay: 60000,
    changeDelay: jest.fn(changeDelay),
    updateData: jest.fn(() => Promise.resolve()),
  };
}

function makeManager(existing: ReturnType<typeof makeJob> | null) {
  const queue = {
    getJob: jest.fn(() => Promise.resolve(existing ?? undefined)),
    add: jest.fn(() => Promise.resolve({ id: 'job' })),
  };

  const manager = new QueueManager<Params, TestJobData>(
    queue as unknown as Queue<CustomJob<TestJobData>>,
    cls,
  );

  return { manager, queue };
}

describe('QueueManager.addJob', () => {
  it('changes the delay and updates the data of a delayed job', async () => {
    const existing = makeJob(() => Promise.resolve());
    const { manager, queue } = makeManager(existing);

    const job = await manager.addJob('job', 'load', { value: 2 });

    expect(job).toBe(existing);
    expect(existing.changeDelay).toHaveBeenCalledWith(0);
    expect(existing.updateData).toHaveBeenCalledTimes(1);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('falls back to adding the job when it is no longer delayed', async () => {
    // BullMQ rejects when the job left the delayed state after it was fetched
    const existing = makeJob(() =>
      Promise.reject(new Error('Job job is not in the delayed state.')),
    );
    const { manager, queue } = makeManager(existing);

    await expect(
      manager.addJob('job', 'load', { value: 2 }),
    ).resolves.toBeDefined();

    expect(existing.updateData).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('adds the job when none exists', async () => {
    const { manager, queue } = makeManager(null);

    await manager.addJob('job', 'load', { value: 1 });

    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});
