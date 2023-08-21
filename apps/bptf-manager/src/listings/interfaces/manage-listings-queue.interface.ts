export interface JobData {
  steamid64: string;
}

export interface JobResult {
  more: boolean;
  amount: number;
  done: boolean;
}

export type JobName = JobType;

export enum JobType {
  Create = 'create',
  Delete = 'delete',
  DeleteArchived = 'delete-archived',
  DeleteAll = 'delete-all',
}
