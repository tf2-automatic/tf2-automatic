import type { Job as BullJob, Worker } from "bullmq";

export type JobData<OptionsType = any, StateType = any, TypeType = string> = {
  type: TypeType;
  options: OptionsType;
  bot?: string;
  state: StateType;
  metadata: {
    userAgent?: string;
  },
  retry?: RetryOptions;
};

export type CustomWorker<DataType extends JobData = JobData, ResultType = any, NameType extends string = string> = Worker<DataType, ResultType, NameType>;

export type CustomJob<DataType extends JobData = JobData, ReturnType = unknown, NameType extends string = string> = 
BullJob<DataType, ReturnType, NameType>;

export interface Job {
  id: string;
  type: string;
  priority: number;
  data: unknown;
  retry?: RetryOptions;
  attempts: number;
  lastProcessedAt: number | null;
  createdAt: number;
}

export interface PaginatedJobs {
  data: Job[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface EnqueueOptions {
  priority?: number;
  retry?: RetryOptions;
  bot?: string;
}

export interface RetryOptions {
  strategy?: 'exponential' | 'linear' | 'fixed';
  maxTime?: number;
  delay?: number;
  maxDelay?: number;
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}
