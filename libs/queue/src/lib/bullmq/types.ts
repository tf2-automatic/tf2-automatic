import { RetryOptions } from '@tf2-automatic/common-data';
import type { Job as BullJob, Worker } from 'bullmq';

export interface BotsAttemptedState {
  botsAttempted?: Record<string, number>;
}

export type JobDataWithBot<
  OptionsType = unknown,
  StateType = unknown,
  TypeType = string,
> = {
  type: TypeType;
  options: OptionsType;
  bot: string;
  state: StateType;
  metadata: {
    userAgent?: string;
  };
  retry?: RetryOptions;
};

export type JobData<
  OptionsType = unknown,
  StateType = unknown,
  TypeType = string,
> = {
  type: TypeType;
  options: OptionsType;
  bot?: string;
  state: StateType;
  metadata: {
    userAgent?: string;
  };
  retry?: RetryOptions;
};

export type CustomWorker<
  DataType extends JobData = JobData,
  ResultType = unknown,
  NameType extends string = string,
> = Worker<DataType, ResultType, NameType>;

export type CustomJob<
  DataType extends JobData = JobData,
  ReturnType = unknown,
  NameType extends string = string,
> = BullJob<DataType, ReturnType, NameType>;

export interface EnqueueOptions {
  priority?: number;
  retry?: RetryOptions;
  bot?: string;
  delay?: number;
}
