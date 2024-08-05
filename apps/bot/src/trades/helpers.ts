import SteamUser from 'steam-user';

export function isCompleted(state?: SteamUser.ETradeOfferState): boolean {
  return !(
    state === SteamUser.ETradeOfferState.Active ||
    state === SteamUser.ETradeOfferState.CreatedNeedsConfirmation ||
    state === SteamUser.ETradeOfferState.InEscrow
  );
}
