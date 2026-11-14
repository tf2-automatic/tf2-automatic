export function calculateBackoff(
  attempts: number,
  strategy: 'exponential' | 'linear' | 'fixed' = 'exponential',
  delay = 1000,
  maxDelay = 60000,
  jitter = 0.2,
): number {
  let wait = delay;

  if (strategy === 'exponential') {
    wait = 2 ** (attempts - 1) * delay;
  } else if (strategy === 'linear') {
    wait = attempts * delay;
  }

  // Randomly shorten the delay so jobs that failed together don't retry together
  return Math.round(Math.min(wait, maxDelay) * (1 - jitter * Math.random()));
}
