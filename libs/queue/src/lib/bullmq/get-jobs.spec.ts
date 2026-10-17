import { Job, Queue } from 'bullmq';
import { getJobs } from './get-jobs';

describe('getJobs', () => {
  it('returns jobs from every state when ranges apply per state', async () => {
    const states = [
      Array.from({ length: 1 }, (_, i) => 'active' + i),
      Array.from({ length: 150 }, (_, i) => 'delayed' + i),
    ];

    // Mimic BullMQ: the range is applied to each state and concatenated
    const queue = {
      getJobs: jest.fn((_types, start: number, end: number) =>
        Promise.resolve(
          states.flatMap((ids) =>
            ids.slice(start, end + 1).map((id) => ({ id }) as Job),
          ),
        ),
      ),
    } as unknown as Queue;

    const jobs = await getJobs(queue, () => true);

    expect(jobs).toHaveLength(151);
    expect(new Set(jobs.map((j) => j.id)).size).toBe(151);
  });
});
