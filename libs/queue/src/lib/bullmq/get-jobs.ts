import { Job, Queue } from 'bullmq';

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

    // The range applies per state, so a short page does not mean the last one
    if (jobs.length === 0) {
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
