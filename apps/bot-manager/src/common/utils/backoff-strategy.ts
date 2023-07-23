import { RetryOptions } from '@tf2-automatic/bot-manager-data';
import { MinimalJob } from 'bullmq';

type BackoffStrategy = (
  attemptsMade: number,
  job: MinimalJob<{ retry?: RetryOptions }>,
) => number;

export const customBackoffStrategy: BackoffStrategy = (attempts, job) => {
  const strategy = job.data.retry?.strategy ?? 'exponential';
  const delay = job.data.retry?.delay ?? 1000;
  const maxDelay = job.data.retry?.maxDelay ?? 10000;

  let wait = delay;

  if (strategy === 'exponential') {
    wait = 2 ** (attempts - 1) * delay;
  } else if (strategy === 'linear') {
    wait = attempts * delay;
  }

  return Math.min(wait, maxDelay);
};
