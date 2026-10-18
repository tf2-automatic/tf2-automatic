import { AxiosError, AxiosResponse } from 'axios';
import { CustomUnrecoverableError } from '@tf2-automatic/queue';
import { TradesProcessor } from './trades.processor';

describe('TradesProcessor', () => {
  let processor: TradesProcessor;

  beforeEach(() => {
    processor = new TradesProcessor(
      {} as never,
      {} as never,
      {} as never,
      {
        run: (fn: () => unknown) => fn(),
      } as never,
    );
  });

  it('does not turn a 429 response into an unrecoverable error', () => {
    const err = new AxiosError('Too Many Requests');
    err.response = {
      status: 429,
      data: { message: 'Too Many Requests', statusCode: 429 },
    } as AxiosResponse;

    // Should be retried like the shared base processor does
    expect(() => (processor as any).handleError(err)).not.toThrow(
      CustomUnrecoverableError,
    );
  });

  it('turns a 400 response into an unrecoverable error', () => {
    const err = new AxiosError('Bad Request');
    err.response = {
      status: 400,
      data: { message: 'Bad Request', statusCode: 400 },
    } as AxiosResponse;

    expect(() => (processor as any).handleError(err)).toThrow(
      CustomUnrecoverableError,
    );
  });
});
