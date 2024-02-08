import { DesiredListing } from '@tf2-automatic/bptf-manager-data';

export interface DesiredListingWithId extends DesiredListing {
  id: string;
}

export interface ExtendedDesiredListing extends DesiredListing {
  force?: boolean;
}
