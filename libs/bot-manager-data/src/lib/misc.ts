import {
  Job as BaseJob,
  RetryOptions as QueueRetryOptions,
} from '@tf2-automatic/queue';

export type RetryOptions = QueueRetryOptions;

export interface Job extends BaseJob {
  bot: string;
}
