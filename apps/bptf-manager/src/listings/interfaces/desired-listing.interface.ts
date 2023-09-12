import { AddListingDto } from '@tf2-automatic/bptf-manager-data';

export enum ListingError {
  // Item does not exist in the agent's inventory on backpack.tf
  ItemDoesNotExist = 'ITEM_DOES_NOT_EXIST',
  // Item is not valid (missing properties, wrong values, etc.)
  InvalidItem = 'INVALID_ITEM',
  // Invalid currencies (missing price, negative price, etc.)
  InvalidCurrencies = 'MISSING_PRICE',
  // The cap was exceeded and the listing was not made
  CapExceeded = 'CAP_EXCEEDED',
  // The listing was not made and the reason is unknown
  Unknown = 'UNKNOWN',
}

export interface DesiredListing {
  // Hash of the assetid or item obejct used as a unique identifier
  hash: string;
  // SteamID64 of the user
  steamid64: string;
  // The id of the backpack.tf listing
  id?: string;
  // The raw listing
  listing: AddListingDto;
  // Priority of the listing
  priority?: number;
  // If this is set then something went wrong and this explains the error
  error?: ListingError;
  // The time when the listing was last attempted to be made
  lastAttemptedAt?: number;
  // Timestamp of when the desired listing was last updated
  updatedAt: number;
}

export interface ExtendedDesiredListing extends DesiredListing {
  force?: boolean;
}
