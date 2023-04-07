export interface RetryOptions {
  strategy?: 'exponential' | 'linear' | 'fixed';
  maxTime?: number;
  delay?: number;
  maxDelay?: number;
}
