import { RetryOptions } from './types';
import { AdvancedOptions, MinimalJob } from 'bullmq';

type BackoffStrategy = (
  attemptsMade: number,
  job?: MinimalJob<{ retry?: RetryOptions }>,
) => number;

export const customBackoffStrategy: BackoffStrategy = (attempts, job) => {
  return calculateBackoff(
    attempts,
    job?.data.retry?.strategy,
    job?.data.retry?.delay,
    job?.data.retry?.maxDelay,
  );
};

export const bullWorkerSettings: AdvancedOptions = {
  backoffStrategy: (attempts: number, _, __, job?: MinimalJob) => {
    return customBackoffStrategy(attempts, job);
  },
};

export function calculateBackoff(
  attempts: number,
  strategy: RetryOptions['strategy'] = 'exponential',
  delay: RetryOptions['delay'] = 1000,
  maxDelay: RetryOptions['maxDelay'] = 10000,
): number {
  let wait = delay;

  if (strategy === 'exponential') {
    wait = 2 ** (attempts - 1) * delay;
  } else if (strategy === 'linear') {
    wait = attempts * delay;
  }

  return Math.min(wait, maxDelay);
}
