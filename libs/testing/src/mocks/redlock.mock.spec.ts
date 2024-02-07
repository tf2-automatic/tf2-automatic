import { redlock } from './redlock.mock';

describe('RedlockMock', () => {
  it('should call the function provided to the using method', async () => {
    const result = await redlock.using('abc', 123, async () => {
      return 'it works';
    });

    expect(result).toBe('it works');
  });
});
