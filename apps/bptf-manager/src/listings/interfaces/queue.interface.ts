export interface JobData {
  steamid64: string;
}

export interface JobResult {
  more: boolean;
  amount: number;
  done: boolean;
}

export type JobName = 'create' | 'delete' | 'deleteArchived';
