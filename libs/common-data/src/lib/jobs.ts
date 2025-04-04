export interface RetryOptions {
  strategy?: 'exponential' | 'linear' | 'fixed';
  maxTime?: number;
  delay?: number;
  maxDelay?: number;
}

export interface JobWithBot extends Job {
  bot: string;
}

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

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface PaginatedJobs {
  data: Job[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}
