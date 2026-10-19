import { RetryOptions } from '@tf2-automatic/common-data';
import { calculateBackoff } from '@tf2-automatic/utils';
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
    job?.data.retry?.jitter,
  );
};

export const bullWorkerSettings: AdvancedOptions = {
  backoffStrategy: (attempts: number, _, __, job?: MinimalJob) => {
    return customBackoffStrategy(attempts, job);
  },
};
