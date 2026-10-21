import SteamUser from 'steam-user';
import SteamTradeOfferManager from 'steam-tradeoffer-manager';

export function isCompleted(state?: SteamUser.ETradeOfferState): boolean {
  return !(
    state === SteamUser.ETradeOfferState.Active ||
    state === SteamUser.ETradeOfferState.CreatedNeedsConfirmation ||
    state === SteamUser.ETradeOfferState.InEscrow
  );
}

export function isFullPoll(args: unknown[]): boolean {
  return (
    args.length === 2 &&
    args[0] === SteamTradeOfferManager.EOfferFilter.All &&
    new Date(args[1] as Date).getTime() === 1000
  );
}
