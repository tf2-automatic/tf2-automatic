import { Queue, RepeatableJob } from 'bullmq';

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
