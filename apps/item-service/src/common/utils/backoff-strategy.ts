import { AdvancedOptions, MinimalJob } from 'bullmq';

type BackoffStrategy = (attemptsMade: number, job: MinimalJob) => number;

export const customBackoffStrategy: BackoffStrategy = (attempts, job) => {
  const strategy = 'exponential';
  const delay = 1000;
  const maxDelay = 10000;

  let wait = delay;

  if (strategy === 'exponential') {
    wait = 2 ** (attempts - 1) * delay;
  } else if (strategy === 'linear') {
    wait = attempts * delay;
  }

  return Math.min(wait, maxDelay);
};

export const bullWorkerSettings: AdvancedOptions = {
  backoffStrategy: (attempts: number, _, __, job: MinimalJob) => {
    return customBackoffStrategy(attempts, job);
  },
};
