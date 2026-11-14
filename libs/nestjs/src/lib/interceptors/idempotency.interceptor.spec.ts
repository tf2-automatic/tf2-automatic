import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

function createContext(): ExecutionContext {
  const request = {
    method: 'POST',
    path: '/test',
    body: { a: 1 },
    headers: { 'x-idempotency-key': 'key' },
  };
  const response = { statusCode: 201, status: jest.fn(), setHeader: jest.fn() };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    interceptor = new IdempotencyInterceptor();
  });

  async function run(context: ExecutionContext, next: CallHandler) {
    return lastValueFrom(await interceptor.intercept(context, next));
  }

  it('does not cache 500 responses', async () => {
    const handle = jest
      .fn()
      .mockReturnValueOnce(
        throwError(() => new InternalServerErrorException('timeout')),
      )
      .mockReturnValueOnce(of('ok'));
    const next = { handle } as CallHandler;

    await expect(run(createContext(), next)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    // Retry with same key must reach the handler again
    await expect(run(createContext(), next)).resolves.toBe('ok');
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it('caches 400 responses', async () => {
    const handle = jest
      .fn()
      .mockReturnValue(throwError(() => new BadRequestException('bad')));
    const next = { handle } as CallHandler;

    await expect(run(createContext(), next)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    // Cached error is replayed without calling the handler
    await expect(run(createContext(), next)).resolves.toEqual(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(handle).toHaveBeenCalledTimes(1);
  });
});
