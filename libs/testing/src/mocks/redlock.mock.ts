import { jest } from '@jest/globals';
import Redlock, { RedlockAbortSignal } from 'redlock';

const mockUsing: jest.Mock = jest
  .fn()
  .mockImplementation(
    async (
      _: unknown,
      __: unknown,
      callback: (signal: Partial<RedlockAbortSignal>) => Promise<unknown>,
    ) => {
      return Promise.resolve().then(() => {
        return callback({ aborted: false });
      });
    },
  );

jest.mock('redlock', () => {
  return jest.fn().mockImplementation(() => redlock);
});

export const redlock: Partial<{ [K in keyof Redlock] }> = {
  using: mockUsing,
};
