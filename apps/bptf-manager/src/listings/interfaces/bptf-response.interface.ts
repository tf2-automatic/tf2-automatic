import { Listing } from '@tf2-automatic/bptf-manager-data';

export interface BatchCreateListingResponse {
  result?: Listing;
  error?: {
    message: string;
  };
}

export interface DeleteListingsResponse {
  deleted: number;
  skipped: unknown[];
  errors: unknown[];
}

export interface BatchDeleteListingResponse {
  deleted: number;
  batchOpLimit: number;
}

export interface DeleteAllListingsResponse {
  deleted: number;
}

export interface ListingLimitsResponse {
  listings: {
    promotionSlotsAvailable: number;
    used: number;
    total: number;
    baseline: number;
    donationBonus: number;
    giftedPremiumMonthsBonus: number;
    multiplier: number;
    twitterFollowerBonus: number;
    acceptedSuggestionBonus: number;
    mvpDonationBonus: number;
    groupMembershipBonus: number;
    bumpInterval: number;
  };
}

export interface GetListingsResponse {
  results: Listing[];
  cursor: {
    skip: number;
    limit: number;
    total: number;
  };
}
