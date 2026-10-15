import { Queue } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { QueueManager } from './manager';
import type { CustomJob, JobData } from './types';

type Params = { value: number };
type TestJobData = JobData<Params>;

const cls = { has: () => false } as unknown as ClsService;

function setup(
  existingDelay: number,
  changeDelay: () => Promise<void> = () => Promise.resolve(),
) {
  const existing = {
    id: 'job',
    timestamp: Date.now(),
    delay: existingDelay,
    changeDelay: jest.fn(changeDelay),
    updateData: jest.fn(() => Promise.resolve()),
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

describe('QueueManager.addJob with an existing job', () => {
  it('runs a delayed job now and updates its data when added without a delay', async () => {
    const { manager, queue, existing } = setup(60000);

    const job = await manager.addJob('job', 'load', { value: 2 });

    expect(job).toBe(existing);
    expect(existing.changeDelay).toHaveBeenCalledWith(0);
    expect(existing.updateData).toHaveBeenCalledWith(
      expect.objectContaining({ options: { value: 2 } }),
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('postpones a delayed job when added with a longer delay', async () => {
    const { manager, existing } = setup(1000);

    await manager.addJob('job', 'load', { value: 2 }, { delay: 60000 });

    expect(existing.changeDelay).toHaveBeenCalledWith(60000);
    expect(existing.updateData).toHaveBeenCalledTimes(1);
  });

  it('keeps a delayed job that runs later than the requested delay', async () => {
    const { manager, queue, existing } = setup(60000);

    await manager.addJob('job', 'load', { value: 2 }, { delay: 1000 });

    expect(existing.changeDelay).not.toHaveBeenCalled();
    expect(existing.updateData).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('does not update a job that is no longer delayed', async () => {
    // Job left the delayed state after it was fetched
    const { manager, queue, existing } = setup(60000, () =>
      Promise.reject(new Error('Job job is not in the delayed state.')),
    );

    await expect(
      manager.addJob('job', 'load', { value: 2 }),
    ).resolves.toBeDefined();

    expect(existing.updateData).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      'job',
      expect.objectContaining({ options: { value: 2 } }),
      expect.objectContaining({ jobId: 'job' }),
    );
  });
});
