import { DefaultJobOptions } from 'bullmq';

export const defaultJobOptions: DefaultJobOptions = {
  attempts: Number.MAX_SAFE_INTEGER,
  backoff: {
    type: 'custom',
  },
  removeOnComplete: true,
  removeOnFail: true,
};
