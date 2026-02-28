import { Queue, QueueEvents } from 'bullmq';
import { CustomJob, EnqueueOptions, JobData } from './types';
import { ClsService } from 'nestjs-cls';
import { GatewayTimeoutException, HttpException } from '@nestjs/common';
import { extractErrorMessage } from './errors';
import { PaginatedJobs, Job } from '@tf2-automatic/common-data';

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

    // Look for existing job
    const existing = await this.getJobById(id);
    if (existing) {
      const delayed = await existing.isDelayed();
      if (delayed) {
        const newDelay = options?.delay ?? 0;

        if (
          newDelay === 0 ||
          existing.timestamp + existing.delay <= Date.now() + newDelay
        ) {
          await Promise.all([
            existing.changeDelay(newDelay),
            existing.updateData(data),
          ]);
          return existing;
        }
      }
    }

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
    const end = start + pageSize;

    const totalPromise = this.queue.getJobCounts().then((counts) => {
      return Object.values(counts).reduce((acc, count) => acc + count, 0);
    });

    const jobsPromise = this.queue
      .getJobs(undefined, start, end)
      .then((jobs) => {
        return jobs.map(this.mapJob);
      });

    const [items, total] = await Promise.all([jobsPromise, totalPromise]);

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
