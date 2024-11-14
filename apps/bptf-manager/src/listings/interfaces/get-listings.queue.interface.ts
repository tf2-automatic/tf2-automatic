export interface JobData {
  steamid64: string;
  start: number;
  skip?: number;
  limit?: number;
}

export type JobName = JobType;

export enum JobType {
  Done = 'done',
  Active = 'active',
  Archived = 'archived',
}
