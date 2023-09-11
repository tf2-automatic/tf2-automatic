export interface JobData {
  steamid64: string;
}

export type JobResult = boolean;

export type JobName = JobType;

export enum JobType {
  Create = 'create',
  Delete = 'delete',
  DeleteArchived = 'delete-archived',
  DeleteAll = 'delete-all',
  Plan = 'plan',
}
