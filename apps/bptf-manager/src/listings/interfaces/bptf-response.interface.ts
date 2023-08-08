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
