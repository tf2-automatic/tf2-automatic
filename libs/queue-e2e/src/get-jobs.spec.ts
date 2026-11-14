import { Queue, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import { getJobs, JobData, QueueManager } from '@tf2-automatic/queue';

// Started by docker-compose.yaml
const connection = { host: 'localhost', port: 6379 };

const cls = { has: () => false } as unknown as ClsService;

type Params = { value: number };

describe('jobs across several states', () => {
  let queue: Queue;
  let worker: Worker | undefined;
  let ids: string[];

  beforeEach(async () => {
    queue = new Queue('get-jobs-spec-' + randomUUID(), { connection });

    await queue.addBulk(
      Array.from({ length: 150 }, (_, i) => ({
        name: 'delayed' + i,
        data: { type: 'load', options: { value: i } },
        opts: { jobId: 'delayed' + i, delay: 600000 },
      })),
    );
    await queue.addBulk(
      Array.from({ length: 25 }, (_, i) => ({
        name: 'waiting' + i,
        data: { type: 'load', options: { value: i } },
        opts: { jobId: 'waiting' + i },
      })),
    );

    // Leave one job active by never finishing it
    worker = new Worker(queue.name, () => new Promise(() => undefined), {
      connection,
      concurrency: 1,
    });
    await new Promise((resolve) => worker?.once('active', resolve));

    ids = (await queue.getJobs(['active', 'waiting', 'delayed'], 0, -1)).map(
      (j) => j.id as string,
    );
    expect(ids).toHaveLength(175);
  });

  afterEach(async () => {
    await worker?.close(true);
    worker = undefined;
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it('getJobs returns every job', async () => {
    const jobs = await getJobs(queue, () => true);

    expect(jobs.map((j) => j.id).sort()).toEqual([...ids].sort());
  });

  it('QueueManager.getJobs pages cover every job exactly once', async () => {
    const manager = new QueueManager<Params, JobData<Params>>(queue, cls);
    const pageSize = 10;

    const seen: string[] = [];
    for (let page = 1; page <= 18; page++) {
      const result = await manager.getJobs(page, pageSize);
      expect(result.total).toBe(175);
      expect(result.data).toHaveLength(page === 18 ? 5 : pageSize);
      seen.push(...result.data.map((j) => j.id));
    }

    expect(new Set(seen).size).toBe(175);
    expect([...seen].sort()).toEqual([...ids].sort());
  });
});
