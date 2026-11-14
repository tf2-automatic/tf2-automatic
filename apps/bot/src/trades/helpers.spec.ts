import SteamTradeOfferManager from 'steam-tradeoffer-manager';
import { isFullPoll } from './helpers';

const { All, ActiveOnly } = SteamTradeOfferManager.EOfferFilter;

describe('isFullPoll', () => {
  it('is true for a full poll', () => {
    expect(isFullPoll([All, new Date(1000)])).toBe(true);
  });

  it('is false for an active only poll', () => {
    expect(isFullPoll([ActiveOnly, new Date(5000)])).toBe(false);
  });

  it('is false when the filter is all but offers were limited by time', () => {
    expect(isFullPoll([All, new Date(5000)])).toBe(false);
  });
});
