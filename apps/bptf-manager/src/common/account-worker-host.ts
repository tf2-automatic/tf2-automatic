import { ClsWorkerHost } from '@tf2-automatic/queue';
import { Job, Worker } from 'bullmq';
import { ClsService } from 'nestjs-cls';

// Jobs for an account log with its steamid64, see AccountLogger
export abstract class AccountWorkerHost<
  JobType extends Job<{ steamid64: string }> = Job<{ steamid64: string }>,
  WorkerType extends Worker = Worker,
> extends ClsWorkerHost<JobType, WorkerType> {
  protected override setContext(cls: ClsService, job: JobType): void {
    cls.set('steamid64', job.data.steamid64);
  }
}
