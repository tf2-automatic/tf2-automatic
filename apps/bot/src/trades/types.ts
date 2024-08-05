import SteamUser from 'steam-user';

export interface TradeOfferData {
  published?: SteamUser.ETradeOfferState;
  conf?: number;
  accept?: number;
  missing?: number;
}
