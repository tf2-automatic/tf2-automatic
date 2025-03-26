import type { RetryOptions } from "@tf2-automatic/bot-manager-data";
import type { Job, Worker } from "bullmq";

export type JobData<OptionsType = any, StateType = any, TypeType = unknown> = {
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
  Job<DataType, ReturnType, NameType>;
