import SteamTradeOfferManager from 'steam-tradeoffer-manager';
import { ETradeOfferState } from 'steam-user';
import { TradesService } from './trades.service';

const { Active, Accepted, CreatedNeedsConfirmation } = ETradeOfferState;
const { None, MobileApp } = SteamTradeOfferManager.EConfirmationMethod;

interface FakeOfferInit {
  state: number;
  confirmationMethod: number;
  isOurOffer?: boolean;
  tradeID?: string | null;
}

// Fresh offer objects share one offerData store, like the real manager
function offerWorld() {
  const store: Record<string, unknown> = {};
  const make = (init: FakeOfferInit) => ({
    id: '9245664060',
    state: init.state,
    confirmationMethod: init.confirmationMethod,
    isOurOffer: init.isOurOffer ?? false,
    tradeID: init.tradeID ?? null,
    data(...args: unknown[]) {
      if (args.length === 0) return { ...store };
      const [key, ...rest] = args as [string, ...unknown[]];
      if (rest.length === 0) return store[key];
      store[key] = rest[0];
      return undefined;
    },
  });
  return { store, make };
}

const logger = { warn: jest.fn() };

// Only needs the offer and logger, so call it on the prototype
const reconcile = (offer: unknown): void =>
  (
    TradesService.prototype as unknown as {
      reconcileConfirmationMethod: (o: unknown) => void;
    }
  ).reconcileConfirmationMethod.call({ logger }, offer);

describe('TradesService.reconcileConfirmationMethod', () => {
  beforeEach(() => logger.warn.mockClear());

  it('restores confirmationMethod after a same-state poll reports None (the bug)', () => {
    const { make } = offerWorld();

    // Accept establishes MobileApp on an Active received offer.
    const accepted = make({ state: Active, confirmationMethod: MobileApp });
    reconcile(accepted);
    expect(accepted.data('lastConfirmationMethod')).toBe(MobileApp);

    // A later poll of the SAME unchanged offer version reports None.
    const polled = make({ state: Active, confirmationMethod: None });
    reconcile(polled);

    expect(polled.confirmationMethod).toBe(MobileApp);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('clears the remembered method once the offer advances state (confirmed)', () => {
    const { make, store } = offerWorld();

    reconcile(make({ state: Active, confirmationMethod: MobileApp }));

    const confirmed = make({ state: Accepted, confirmationMethod: None });
    reconcile(confirmed);

    expect(confirmed.confirmationMethod).toBe(None);
    expect(store.lastConfirmationMethod).toBeUndefined();
  });

  it('does not resurrect the method once a tradeID is present', () => {
    const { make } = offerWorld();
    reconcile(make({ state: Active, confirmationMethod: MobileApp }));

    const withTrade = make({
      state: Active,
      confirmationMethod: None,
      tradeID: '111222333',
    });
    reconcile(withTrade);

    expect(withTrade.confirmationMethod).toBe(None);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not resurrect on an Active SENT offer (already sent/confirmed)', () => {
    const { make } = offerWorld();

    // Sent offer awaited our confirmation...
    reconcile(
      make({
        state: CreatedNeedsConfirmation,
        confirmationMethod: MobileApp,
        isOurOffer: true,
      }),
    );

    // ...then we confirmed it and it became Active. None is authoritative here.
    const sentActive = make({
      state: Active,
      confirmationMethod: None,
      isOurOffer: true,
    });
    reconcile(sentActive);

    expect(sentActive.confirmationMethod).toBe(None);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('leaves a genuine None untouched when nothing was ever remembered', () => {
    const { make } = offerWorld();
    const fresh = make({ state: Active, confirmationMethod: None });
    reconcile(fresh);

    expect(fresh.confirmationMethod).toBe(None);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
