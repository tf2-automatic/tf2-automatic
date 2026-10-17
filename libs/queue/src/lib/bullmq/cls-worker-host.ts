import { WorkerHost } from '@nestjs/bullmq';
import { Job, Worker } from 'bullmq';
import { ClsService } from 'nestjs-cls';

// Runs every job in its own CLS context, with values picked by the subclass
export abstract class ClsWorkerHost<
  JobType extends Job = Job,
  WorkerType extends Worker = Worker,
> extends WorkerHost<WorkerType> {
  readonly #cls: ClsService;

  constructor(cls: ClsService) {
    super();

    this.#cls = cls;
  }

  process(job: JobType, token?: string): Promise<unknown> {
    this.#cls.enter();

    this.setContext(this.#cls, job);

    return this.processInContext(job, token);
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */

  protected setContext(cls: ClsService, job: JobType): void {
    // Nothing is set by default
  }

  /* eslint-enable @typescript-eslint/no-unused-vars */

  protected processInContext(job: JobType, token?: string): Promise<unknown> {
    return this.processJob(job, token);
  }

  abstract processJob(job: JobType, token?: string): Promise<unknown>;
}
