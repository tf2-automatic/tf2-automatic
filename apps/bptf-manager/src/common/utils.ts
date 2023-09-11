import { Job, Queue } from 'bullmq';

interface RepeatableJob {
  key: string;
  name: string;
  id: string;
  endDate: number;
  tz: string;
  pattern: string;
  next: number;
}

export async function getRepeatableJob(
  queue: Queue,
  filter: (job: RepeatableJob) => boolean,
  batchSize = 100,
): Promise<RepeatableJob | null> {
  let match: RepeatableJob | undefined;

  let start = 0;
  let moreJobs = true;

  while (match === undefined && moreJobs) {
    const end = start + batchSize;
    const jobs = await queue.getRepeatableJobs(start, end, true);

    if (jobs.length !== 1 + end - start) {
      moreJobs = false;
    }

    match = jobs.find(filter);

    start = end + 1;
  }

  return match ?? null;
}

export async function getJobs(
  queue: Queue,
  filter: (job: Job) => boolean,
  batchSize = 100,
): Promise<Job[]> {
  const match: Job[] = [];

  let start = 0;
  let moreJobs = true;

  while (moreJobs) {
    const end = start + batchSize;
    const jobs = await queue.getJobs(undefined, start, end, true);

    if (jobs.length !== 1 + end - start) {
      moreJobs = false;
    }

    jobs.forEach((job) => {
      if (filter(job)) {
        match.push(job);
      }
    });

    start = end + 1;
  }

  return match;
}
