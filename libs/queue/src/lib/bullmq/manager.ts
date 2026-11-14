import { Queue, QueueEvents } from 'bullmq';
import { CustomJob, EnqueueOptions, JobData } from './types';
import { ClsService } from 'nestjs-cls';
import { GatewayTimeoutException, HttpException } from '@nestjs/common';
import { extractErrorMessage } from './errors';
import { PaginatedJobs, Job } from '@tf2-automatic/common-data';

const JOB_STATES = [
  'active',
  'waiting',
  'prioritized',
  'paused',
  'delayed',
  'waiting-children',
  'completed',
  'failed',
] as const;

export class QueueManager<
  ParameterType,
  DataType extends JobData,
  OptionsType extends EnqueueOptions = EnqueueOptions,
> {
  constructor(
    private readonly queue: Queue<CustomJob<DataType>>,
    private readonly cls: ClsService,
  ) {}

  async getJobById(id: string): Promise<CustomJob<DataType> | null> {
    return this.queue.getJob(id).then((job) => {
      if (!job) {
        return null;
      }

      return job;
    });
  }

  async addJob(
    id: string,
    type: string,
    params: ParameterType,
    options?: OptionsType,
  ): Promise<CustomJob<DataType>> {
    const data: DataType = {
      type,
      options: params, // Use params directly as options
      state: {},
      bot: options?.bot,
      retry: options?.retry,
      metadata: {},
    } as DataType;

    if (this.cls.has('userAgent')) {
      data.metadata.userAgent = this.cls.get('userAgent');
    }

    const existing = await this.getJobById(id);
    const state = await existing?.getState();
    if (existing && state !== 'unknown') {
      // Don't modify a job a worker is processing
      if (state !== 'active') {
        const removed = await existing.updateData(data).then(
          () => false,
          (err) => {
            // bullmq has no error code, the job completed and was removed after it was read
            if (
              err instanceof Error &&
              err.message.startsWith('Missing key for job ')
            ) {
              return true;
            }
            throw err;
          },
        );

        if (removed) {
          return this.createJob(id, data, options);
        }

        const newDelay = options?.delay ?? 0;
        if (
          newDelay === 0 ||
          existing.timestamp + existing.delay <= Date.now() + newDelay
        ) {
          // Fails if the job is no longer delayed
          await existing.changeDelay(newDelay).catch(() => undefined);
        }
      }

      return existing;
    }

    return this.createJob(id, data, options);
  }

  private createJob(
    id: string,
    data: DataType,
    options?: OptionsType,
  ): Promise<CustomJob<DataType>> {
    return this.queue.add(id, data, {
      jobId: id,
      backoff: {
        type: 'custom',
      },
      delay: options?.delay ?? undefined,
    });
  }

  async removeJobById(id: string): Promise<boolean> {
    const removed = await this.queue.remove(id);
    return removed === 1;
  }

  async getJobs(page: number, pageSize: number): Promise<PaginatedJobs> {
    const start = (page - 1) * pageSize;

    const counts = await this.queue.getJobCounts(...JOB_STATES);
    const total = Object.values(counts).reduce((acc, count) => acc + count, 0);

    // BullMQ applies a range per state, so page through the states in order
    const jobs: CustomJob<DataType>[] = [];
    let offset = 0;
    for (const state of JOB_STATES) {
      const count = counts[state] ?? 0;
      const from = Math.max(start - offset, 0);
      const need = pageSize - jobs.length;
      offset += count;

      if (from >= count) {
        continue;
      }

      jobs.push(...(await this.queue.getJobs([state], from, from + need - 1)));

      if (jobs.length >= pageSize) {
        break;
      }
    }

    const items = jobs.map(this.mapJob);

    return {
      data: items,
      total,
      totalPages: Math.ceil(total / pageSize),
      page,
      perPage: pageSize,
    };
  }

  private mapJob(job: CustomJob<DataType>): Job {
    return {
      id: job.id as string,
      type: job.data.type,
      priority: job.priority,
      data: job.data.options,
      retry: job.data.retry,
      attempts: job.attemptsMade,
      lastProcessedAt:
        job.processedOn === undefined
          ? null
          : Math.floor(job.processedOn / 1000),
      createdAt: Math.floor(job.timestamp / 1000),
    };
  }
}

export class QueueManagerWithEvents<
  ParameterType,
  DataType extends JobData,
  OptionsType extends EnqueueOptions = EnqueueOptions,
> extends QueueManager<ParameterType, DataType, OptionsType> {
  private readonly queueEvents: QueueEvents;

  constructor(queue: Queue<CustomJob<DataType>>, cls: ClsService) {
    super(queue, cls);

    this.queueEvents = new QueueEvents(queue.name, {
      autorun: true,
      prefix: queue.opts.prefix,
      connection: queue.opts.connection,
    });
  }

  async waitUntilFinished(
    job: CustomJob<DataType>,
    ttl?: number,
  ): Promise<void> {
    if (job.id === null) {
      return Promise.resolve();
    }

    await job.waitUntilFinished(this.queueEvents, ttl).catch((err) => {
      if (
        err.message.startsWith(
          'Job wait ' + job.id + ' timed out before finishing',
        )
      ) {
        throw new GatewayTimeoutException(
          'Timed out waiting for job to finish',
        );
      }

      const httpError = extractErrorMessage(err);
      if (httpError.message) {
        throw new HttpException(httpError.message, httpError.statusCode ?? 500);
      }

      throw err;
    });
  }

  async close() {
    return this.queueEvents.close();
  }
}
