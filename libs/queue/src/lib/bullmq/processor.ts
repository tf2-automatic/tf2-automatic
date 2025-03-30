import { OnWorkerEvent, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import type { CustomJob, CustomWorker, JobData } from './types';
import { customBackoffStrategy } from './backoff-strategy';
import { AxiosError } from 'axios';
import { CustomError, CustomUnrecoverableError } from './errors';
import { HttpError } from '@tf2-automatic/bot-data';
import { HttpException, Logger } from '@nestjs/common';

export abstract class CustomWorkerHost<
  DataType extends JobData,
  ReturnType = unknown,
  NameType extends string = string,
> extends WorkerHost<CustomWorker<DataType>> {
  logger = new Logger(this.constructor.name);

  #cls: ClsService;

  constructor(cls: ClsService) {
    super();

    this.#cls = cls;
  }

  process(job: CustomJob<DataType, ReturnType, NameType>) {
    this.logger.log(
      `Processing job ${
        job.data.type !== undefined ? job.data.type + ' ' : ''
      }${job.id} attempt #${job.attemptsMade + 1}...`,
    );

    this.#cls.enter();

    this.#cls.set('timestamp', Math.floor(Date.now() / 1000));

    for (const key in job.data.metadata) {
      const value = job.data.metadata[key as keyof typeof job.data.metadata];
      this.#cls.set(key, value);
    }

    return this.processJobWithErrorHandler(job);
  }

  abstract processJob(
    job: CustomJob<DataType, ReturnType, NameType>,
  ): Promise<ReturnType>;

  preErrorHandler(
    job: CustomJob<DataType, ReturnType, NameType>,
    err: unknown,
  ): Promise<void> {
    return Promise.resolve();
  }

  postErrorHandler(
    job: CustomJob<DataType, ReturnType, NameType>,
    err: unknown,
  ): Promise<void> {
    return Promise.resolve();
  }

  private async processJobWithErrorHandler(
    job: CustomJob<DataType, ReturnType, NameType>,
  ): Promise<unknown> {
    // TODO: Allow ignoring max time?
    const maxTime = job.data?.retry?.maxTime ?? 120000;

    // Check if job is too old
    if (job.timestamp < Date.now() - maxTime) {
      throw new UnrecoverableError('Job is too old');
    }

    return this.processJob(job)
      .catch(async (err) => {
        await this.preErrorHandler(job, err);

        if (err instanceof AxiosError) {
          const response =
            err.response satisfies AxiosError<HttpError>['response'];

          if (
            response !== undefined &&
            response.status < 500 &&
            response.status >= 400
          ) {
            // Don't retry on 4xx errors
            throw new CustomUnrecoverableError(
              response.data.message,
              response.data,
            );
          }
        } else if (err instanceof HttpException) {
          const status = err.getStatus();
          if (status < 500 && status >= 400) {
            // Don't retry on 4xx errors
            const response = err.getResponse();
            if (typeof response === 'object') {
              throw new CustomUnrecoverableError(err.message, response);
            } else {
              throw new CustomUnrecoverableError(err.message, {
                message: response,
                statusCode: status,
              });
            }
          }
        }

        // Unknown error
        throw err;
      })
      .catch(async (err) => {
        await this.postErrorHandler(job, err);

        // Check if job will be too old when it can be retried again
        const delay = customBackoffStrategy(job.attemptsMade, job);
        if (job.timestamp < Date.now() + delay - maxTime) {
          if (err instanceof AxiosError && err.response !== undefined) {
            // Is axios error, throw custom unrecoverable error with axios response
            throw new CustomUnrecoverableError(
              'Job is too old to be retried',
              err.response.data,
            );
          }

          // Is not axios error, throw normal unrecoverable error
          throw new UnrecoverableError('Job is too old to be retried');
        }

        if (err instanceof AxiosError && err.response !== undefined) {
          // Not a unrecoverable error, and is an axios error, throw custom error with axios response
          throw new CustomError(err.response.data.message, err.response.data);
        }

        throw err;
      });
  }

  @OnWorkerEvent('error')
  private onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  private onFailed(job: Job, err: Error): void {
    this.logger.warn(`Failed job ${job.id}: ${err.message}`);
    if (err instanceof AxiosError) {
      if (err.response !== undefined) {
        console.log(err.response.data);
      }
    } else if (err instanceof HttpException) {
      console.log(err);
    }
  }

  @OnWorkerEvent('completed')
  private onCompleted(job: Job): void {
    this.logger.log(`Completed job ${job.id}`);
  }
}
