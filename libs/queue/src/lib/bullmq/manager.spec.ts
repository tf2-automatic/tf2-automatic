import { Queue } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { QueueManager } from './manager';
import type { CustomJob, JobData } from './types';

type Params = { value: number };
type TestJobData = JobData<Params>;

const cls = { has: () => false } as unknown as ClsService;

function setup(state: string, existingDelay = 60000) {
  const existing = {
    id: 'job',
    timestamp: Date.now(),
    delay: existingDelay,
    getState: jest.fn(() => Promise.resolve(state)),
    updateData: jest.fn(() => Promise.resolve()),
    changeDelay: jest.fn(() => Promise.resolve()),
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
  it('updates the data of a waiting job', async () => {
    const { manager, queue, existing } = setup('waiting');

    const job = await manager.addJob('job', 'load', { value: 2 });

    expect(job).toBe(existing);
    expect(existing.updateData).toHaveBeenCalledWith(
      expect.objectContaining({ options: { value: 2 } }),
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('postpones a delayed job when added with a longer delay', async () => {
    const { manager, existing } = setup('delayed', 1000);

    await manager.addJob('job', 'load', { value: 2 }, { delay: 60000 });

    expect(existing.updateData).toHaveBeenCalledTimes(1);
    expect(existing.changeDelay).toHaveBeenCalledWith(60000);
  });

  it('keeps the delay of a job that runs later than the requested delay', async () => {
    const { manager, existing } = setup('delayed', 60000);

    await manager.addJob('job', 'load', { value: 2 }, { delay: 1000 });

    expect(existing.updateData).toHaveBeenCalledTimes(1);
    expect(existing.changeDelay).not.toHaveBeenCalled();
  });

  it('does not modify a job a worker is processing', async () => {
    const { manager, queue, existing } = setup('active');

    const job = await manager.addJob('job', 'load', { value: 2 });

    expect(job).toBe(existing);
    expect(existing.updateData).not.toHaveBeenCalled();
    expect(existing.changeDelay).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('adds the job when it was removed in the meantime', async () => {
    const { manager, queue, existing } = setup('unknown');

    await manager.addJob('job', 'load', { value: 2 });

    expect(existing.updateData).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});
