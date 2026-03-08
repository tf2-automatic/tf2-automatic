import TradeOffer from 'steam-tradeoffer-manager/lib/classes/TradeOffer';
import SteamUser from 'steam-user';

export interface TradeOfferData {
  published?: SteamUser.ETradeOfferState;
  conf?: number;
  accept?: number;
  missing?: number;
}

export type CreatedTradeOffer = TradeOffer & {
  id: string;
};

export type ActiveTradeOffer = CreatedTradeOffer & {
  state: SteamUser.ETradeOfferState.Active;
};

export type OurTradeOffer = CreatedTradeOffer & {
  isOurOffer: true;
};

export type TheirTradeOffer = CreatedTradeOffer & {
  isOurOffer: false;
};
