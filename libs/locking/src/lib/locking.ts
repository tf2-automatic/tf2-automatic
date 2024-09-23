import { getLockConfig } from '@tf2-automatic/config';
import { Redis } from 'ioredis';
import Redlock, { RedlockAbortSignal } from 'redlock';

export enum LockDuration {
  SHORT,
  MEDIUM,
  LONG,
}

export class Locker {
  private readonly redlock: Redlock;

  private readonly config = getLockConfig();

  private readonly prefix = 'locking:';

  constructor(private readonly redis: Redis) {
    this.redlock = new Redlock([this.redis], this.config);
  }

  private getDuration(duration: LockDuration): number {
    switch (duration) {
      case LockDuration.SHORT:
        return this.config.durationShort;
      case LockDuration.MEDIUM:
        return this.config.durationMedium;
      case LockDuration.LONG:
        return this.config.durationLong;
    }
  }

  async using<T>(
    resources: string[],
    duration: LockDuration,
    routine: (signal: RedlockAbortSignal) => Promise<T>,
  ): Promise<T> {
    const prefixed = resources.map((resource) => this.prefix + resource);

    return this.redlock.using(
      prefixed,
      this.getDuration(duration) * this.config.durationMultiplier,
      routine,
    );
  }
}
