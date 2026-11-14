import { ClsWorkerHost } from '@tf2-automatic/queue';
import { AxiosError } from 'axios';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import { ClsService } from 'nestjs-cls';

// A 4xx from backpack.tf won't change on a retry; 429 is delayed by the rate limiter
export function failOnClientError(err: unknown): never {
  const status = err instanceof AxiosError ? err.response?.status : undefined;

  if (status !== undefined && status >= 400 && status < 500 && status !== 429) {
    throw new UnrecoverableError(
      `Backpack.tf returned non-retryable status ${status}`,
    );
  }

  throw err;
}

// Jobs for an account log with its steamid64, see AccountLogger
export abstract class AccountWorkerHost<
  JobType extends Job<{ steamid64: string }> = Job<{ steamid64: string }>,
  WorkerType extends Worker = Worker,
> extends ClsWorkerHost<JobType, WorkerType> {
  protected override setContext(cls: ClsService, job: JobType): void {
    cls.set('steamid64', job.data.steamid64);
  }

  protected override processInContext(
    job: JobType,
    token?: string,
  ): Promise<unknown> {
    return super.processInContext(job, token).catch(failOnClientError);
  }
}
