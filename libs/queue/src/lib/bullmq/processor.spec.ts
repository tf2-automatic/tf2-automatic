import { AxiosError, AxiosHeaders } from 'axios';
import { UnrecoverableError } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { AsyncLocalStorage } from 'async_hooks';
import { CustomWorkerHost } from './processor';
import { CustomError, CustomUnrecoverableError } from './errors';
import type { CustomJob, JobData } from './types';

type TestJobData = JobData<unknown>;

class TestProcessor extends CustomWorkerHost<TestJobData> {
  readonly failures: unknown[] = [];

  constructor(private readonly thrown?: unknown) {
    super(new ClsService(new AsyncLocalStorage()));
  }

  async processJob(): Promise<unknown> {
    if (this.thrown !== undefined) {
      throw this.thrown;
    }

    return 'ok';
  }

  override async onJobFailed(
    job: CustomJob<TestJobData>,
    err: unknown,
  ): Promise<void> {
    this.failures.push(err);
  }
}

function makeJob(overrides: Partial<CustomJob<TestJobData>> = {}) {
  return {
    id: '1',
    timestamp: Date.now(),
    attemptsMade: 0,
    data: { metadata: {}, state: {}, options: {} },
    ...overrides,
  } as CustomJob<TestJobData>;
}

function axios404() {
  const err = new AxiosError('Request failed');
  err.response = {
    status: 404,
    statusText: 'Not Found',
    data: { message: 'Not found', statusCode: 404 },
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return err;
}

describe('CustomWorkerHost', () => {
  it('calls onJobFailed for jobs that are too old to start', async () => {
    const processor = new TestProcessor();
    const spy = jest.spyOn(processor, 'processJob');

    await expect(
      processor.process(makeJob({ timestamp: Date.now() - 200000 })),
    ).rejects.toThrow('Job is too old');

    expect(spy).not.toHaveBeenCalled();
    expect(processor.failures).toHaveLength(1);
    expect(processor.failures[0]).toBeInstanceOf(UnrecoverableError);
  });

  it('calls onJobFailed exactly once with the transformed 4xx error', async () => {
    const processor = new TestProcessor(axios404());

    await expect(processor.process(makeJob())).rejects.toThrow(
      CustomUnrecoverableError,
    );

    expect(processor.failures).toHaveLength(1);
    const err = processor.failures[0] as CustomUnrecoverableError;
    expect(err).toBeInstanceOf(CustomUnrecoverableError);
    expect(err.response).toEqual({ message: 'Not found', statusCode: 404 });
  });

  it('keeps a transient error retryable while the job is young', async () => {
    const processor = new TestProcessor(new Error('Bot not found'));

    await expect(processor.process(makeJob())).rejects.toThrow('Bot not found');

    expect(processor.failures).toHaveLength(1);
    expect(processor.failures[0]).not.toBeInstanceOf(UnrecoverableError);
  });

  it('reports that the job is too old instead of the last error', async () => {
    const processor = new TestProcessor(new Error('Bot not found'));

    // 90s old, next retry 60s out, past the 120s maxTime
    await expect(
      processor.process(
        makeJob({ timestamp: Date.now() - 90000, attemptsMade: 10 }),
      ),
    ).rejects.toThrow('Job is too old to be retried');

    expect(processor.failures).toHaveLength(1);
    const err = processor.failures[0] as UnrecoverableError;
    expect(err).toBeInstanceOf(UnrecoverableError);
    expect(err.message).toBe('Job is too old to be retried');
  });

  it('keeps an unrecoverable error instead of rewriting it as too old', async () => {
    const processor = new TestProcessor(axios404());

    // 90s old, next retry 60s out, past the 120s maxTime
    await expect(
      processor.process(
        makeJob({ timestamp: Date.now() - 90000, attemptsMade: 10 }),
      ),
    ).rejects.toThrow('Upstream error: Not found (HTTP 404)');

    expect(processor.failures).toHaveLength(1);
    const err = processor.failures[0] as CustomUnrecoverableError;
    expect(err.response).toEqual({ message: 'Not found', statusCode: 404 });
  });

  it('does not let a failing onJobFailed mask the original error', async () => {
    const processor = new TestProcessor(new CustomError('Boom', {}));
    jest
      .spyOn(processor, 'onJobFailed')
      .mockRejectedValue(new Error('hook exploded'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(processor.process(makeJob())).rejects.toThrow(
      'Upstream error: Boom',
    );
  });

  it('does not call onJobFailed when the job succeeds', async () => {
    const processor = new TestProcessor();

    await expect(processor.process(makeJob())).resolves.toBe('ok');
    expect(processor.failures).toHaveLength(0);
  });
});
