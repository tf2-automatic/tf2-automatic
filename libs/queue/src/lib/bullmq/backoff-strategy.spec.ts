import { calculateBackoff } from './backoff-strategy';

describe('calculateBackoff', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shortens the capped delay by up to the jitter', () => {
    // 2^9 * 1000 is capped at the 60s max delay
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(calculateBackoff(10)).toBe(60000);

    jest.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(calculateBackoff(10)).toBe(48012);
  });

  it('uses the exact delay without jitter', () => {
    expect(calculateBackoff(3, 'exponential', 1000, 60000, 0)).toBe(4000);
  });
});
