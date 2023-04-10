export interface RetryOptions {
  strategy?: 'exponential' | 'linear' | 'fixed';
  maxTime?: number;
  delay?: number;
  maxDelay?: number;
}

export interface Job {
  id: string;
  type: string;
  data: unknown;
  bot: string;
  attempts: number;
  lastProcessedAt: number | null;
  createdAt: number;
}
