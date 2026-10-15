import { Queue } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { QueueManager } from './manager';
import type { CustomJob, JobData } from './types';

type Params = { value: number };
type TestJobData = JobData<Params>;

const cls = { has: () => false } as unknown as ClsService;

function setup(
  existingDelay: number,
  remove: () => Promise<void> = () => Promise.resolve(),
) {
  const existing = {
    id: 'job',
    timestamp: Date.now(),
    delay: existingDelay,
    remove: jest.fn(remove),
  };

  const queue = {
    getJob: jest.fn(() => Promise.resolve(existing)),
    add: jest.fn(() => Promise.resolve({ id: 'job' })),
  };

  const manager = new QueueManager<Params, TestJobData>(
    queue as unknown as Queue<CustomJob<TestJobData>>,
    cls,
  );

  return { manager, queue, existing };
}

function addedDelay(queue: ReturnType<typeof setup>['queue']): number {
  const calls = queue.add.mock.calls as unknown as [
    string,
    unknown,
    { delay?: number },
  ][];
  return calls[0][2].delay ?? 0;
}

describe('QueueManager.addJob with an existing job', () => {
  it('replaces the job with the new data', async () => {
    const { manager, queue, existing } = setup(60000);

    await manager.addJob('job', 'load', { value: 2 });

    expect(existing.remove).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      'job',
      expect.objectContaining({ options: { value: 2 } }),
      expect.objectContaining({ jobId: 'job' }),
    );
    expect(addedDelay(queue)).toBe(0);
  });

  it('uses the new delay when it is later', async () => {
    const { manager, queue } = setup(1000);

    await manager.addJob('job', 'load', { value: 2 }, { delay: 60000 });

    expect(addedDelay(queue)).toBe(60000);
  });

  it('keeps the existing delay when it is later', async () => {
    const { manager, queue } = setup(60000);

    await manager.addJob('job', 'load', { value: 2 }, { delay: 1000 });

    expect(addedDelay(queue)).toBeGreaterThan(59000);
  });

  it('keeps a job that a worker is processing', async () => {
    const { manager, queue, existing } = setup(0, () =>
      Promise.reject(new Error('Job job could not be removed')),
    );

    const job = await manager.addJob('job', 'load', { value: 2 });

    expect(job).toBe(existing);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
