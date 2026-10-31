import { OnWorkerEvent } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import SteamID from 'steamid';
import type { CustomJob, CustomWorker, JobData } from './types';
import { customBackoffStrategy } from './backoff-strategy';
import { AxiosError } from 'axios';
import {
  CustomError,
  CustomHttpException,
  CustomUnrecoverableError,
} from './errors';
import { HttpError } from '@tf2-automatic/bot-data';
import {
  HttpException,
  Inject,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { AssertionError } from 'assert';
import { ClsWorkerHost } from './cls-worker-host';
import {
  delayJobForOfflineBot,
  BotStatus,
  OFFLINE_BOT_DELAY,
  promoteOfflineBotJobs,
} from './offline-bots';
import { DelaysOfflineBotJobs } from './offline-bot-jobs.service';

export abstract class CustomWorkerHost<
  DataType extends JobData,
  ReturnType = unknown,
  NameType extends string = string,
> extends ClsWorkerHost<
  CustomJob<DataType, ReturnType, NameType>,
  CustomWorker<DataType>
> {
  logger = new Logger(this.constructor.name);

  @Optional()
  @Inject(BotStatus)
  private readonly botStatus?: BotStatus;

  override process(
    job: CustomJob<DataType, ReturnType, NameType>,
    token?: string,
  ) {
    this.logger.log(
      `Processing job ${
        job.data.type !== undefined ? job.data.type + ' ' : ''
      }${job.id} attempt #${job.attemptsMade + 1}...`,
    );

    return super.process(job, token);
  }

  protected override setContext(
    cls: ClsService,
    job: CustomJob<DataType, ReturnType, NameType>,
  ): void {
    cls.set('timestamp', Math.floor(Date.now() / 1000));

    if (job.data.metadata.userAgent !== undefined) {
      cls.set('userAgent', job.data.metadata.userAgent);
    }
  }

  protected override processInContext(
    job: CustomJob<DataType, ReturnType, NameType>,
    token?: string,
  ): Promise<unknown> {
    return this.processJobWithErrorHandler(job, token);
  }

  abstract override processJob(
    job: CustomJob<DataType, ReturnType, NameType>,
  ): Promise<ReturnType>;

  /* eslint-disable @typescript-eslint/no-unused-vars */

  preErrorHandler(
    job: CustomJob<DataType, ReturnType, NameType>,
    err: unknown,
  ): Promise<void> {
    return Promise.resolve();
  }

  promoteOfflineBotJobs(steamid: SteamID): Promise<void> {
    return promoteOfflineBotJobs(this.worker, steamid.getSteamID64());
  }

  onJobFailed(
    job: CustomJob<DataType, ReturnType, NameType>,
    err: unknown,
  ): Promise<void> {
    return Promise.resolve();
  }

  private getStatusAndResponseFromError(err: Error): {
    status: number;
    response: string | object;
  } | null {
    if (err instanceof AxiosError) {
      const response = err.response satisfies AxiosError<HttpError>['response'];

      if (response === undefined) {
        return null;
      }

      return {
        status: response.status,
        response: response.data,
      };
    }

    if (err instanceof HttpException) {
      return {
        status: err.getStatus(),
        response: err.getResponse(),
      };
    }

    return null;
  }

  /* eslint-enable @typescript-eslint/no-unused-vars */

  onModuleInit(): void {
    if (this.delaysOfflineBotJobs() && this.botStatus === undefined) {
      throw new Error(
        `${this.constructor.name} uses @DelaysOfflineBotJobs() but no BotStatus is provided`,
      );
    }
  }

  private delaysOfflineBotJobs(): boolean {
    return Reflect.hasMetadata(DelaysOfflineBotJobs.KEY, this.constructor);
  }

  // Only processors marked with @DelaysOfflineBotJobs() are also woken up again
  private isBotOffline(steamid: SteamID): Promise<boolean> {
    if (!this.delaysOfflineBotJobs() || this.botStatus === undefined) {
      return Promise.resolve(false);
    }

    return this.botStatus.isBotOffline(steamid);
  }

  private async processJobWithErrorHandler(
    job: CustomJob<DataType, ReturnType, NameType>,
    token?: string,
  ): Promise<unknown> {
    // TODO: Allow ignoring max time?
    const maxTime = job.data?.retry?.maxTime ?? 120000;

    // Check if job is too old
    if (job.timestamp < Date.now() - maxTime) {
      const err = new UnrecoverableError('Job is too old');
      // processJob is never reached, so call the hook here instead
      await this.jobFailed(job, err);
      throw err;
    }

    const bot = job.data.bot;
    if (
      bot !== undefined &&
      token !== undefined &&
      (await this.isBotOffline(new SteamID(bot)))
    ) {
      this.logger.log(`Bot ${bot} is offline, delaying job ${job.id}`);
      const remaining = job.timestamp + maxTime - Date.now();
      await delayJobForOfflineBot(
        this.worker,
        job,
        bot,
        token,
        Math.min(OFFLINE_BOT_DELAY, remaining),
      );
    }

    return this.processJob(job)
      .catch(async (err) => {
        await this.preErrorHandler(job, err);

        const statusAndResponse = this.getStatusAndResponseFromError(err);
        if (statusAndResponse !== null) {
          const { status, response } = statusAndResponse;

          const retryable = err instanceof CustomHttpException && err.retryable;

          if (!retryable && status < 500 && status >= 400 && status !== 429) {
            // Don't retry on 4xx errors except for 429
            if (typeof response === 'object') {
              throw new CustomUnrecoverableError(err.message, response);
            } else {
              throw new CustomUnrecoverableError(err.message, {
                message: response,
                statusCode: status,
              });
            }
          }
        } else if (err instanceof AssertionError) {
          // This is a bug in the code, not a recoverable error
          this.logger.error('Assertion failed in worker');
          console.error(err);
          throw new UnrecoverableError(err.message);
        }

        // Unknown error
        throw err;
      })
      .catch(async (err) => {
        // Check if job will be too old when it can be retried again
        const delay = customBackoffStrategy(job.attemptsMade, job);
        const tooOld = job.timestamp < Date.now() + delay - maxTime;

        // Only rewrite the error if the job would otherwise have been retried
        if (tooOld && !(err instanceof UnrecoverableError)) {
          const failure = new UnrecoverableError(
            'Job is too old to be retried',
          );

          await this.jobFailed(job, failure);

          throw failure;
        }

        await this.jobFailed(job, err);

        if (err instanceof AxiosError && err.response !== undefined) {
          // Not a unrecoverable error, and is an axios error, throw custom error with axios response
          throw new CustomError(err.response.data.message, err.response.data);
        }

        throw err;
      });
  }

  private jobFailed(
    job: CustomJob<DataType, ReturnType, NameType>,
    err: unknown,
  ): Promise<void> {
    return this.onJobFailed(job, err).catch((hookErr) => {
      this.logger.error('Error in onJobFailed handler');
      console.error(hookErr);
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
