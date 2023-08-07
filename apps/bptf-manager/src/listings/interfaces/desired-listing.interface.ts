import { ListingDto } from '@tf2-automatic/bptf-manager-data';

export interface DesiredListing {
  // Hash of the assetid or item obejct used as a unique identifier
  hash: string;
  // SteamID64 of the user
  steamid64: string;
  // The id of the backpack.tf listing
  id?: string;
  // If the listing is archived
  archived?: boolean;
  // The raw listing
  listing: ListingDto;
  // Priority of the listing
  priority?: number;
  // If this is set then something went wrong and this explains the error
  message?: string;
  // Timestamp of when the desired listing was last updated
  updatedAt: number;
}
