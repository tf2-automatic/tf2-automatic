import SteamID from 'steamid';
import { Listing, ListingError } from '@tf2-automatic/bptf-manager-data';
import { AddDesiredListing } from '../classes/add-desired-listing.class';
import { DesiredListing } from '../classes/desired-listing.class';

interface BaseDesiredListingsEvent {
  steamid: SteamID;
  desired: DesiredListing[];
}

export interface DesiredListingsAddedEvent extends BaseDesiredListingsEvent {
  desired: AddDesiredListing[];
}
export type DesiredListingsRemovedEvent = BaseDesiredListingsEvent;
export interface DesiredListingsCreatedEvent extends BaseDesiredListingsEvent {
  listings: Record<string, Listing>;
}

export interface CurrentListingsCreatedEvent {
  steamid: SteamID;
  listings: Record<string, Listing>;
}

export interface CurrentListingsCreateFailedEvent {
  steamid: SteamID;
  errors: Record<string, ListingError>;
}

export interface CurrentListingsDeletedEvent {
  steamid: SteamID;
  ids: string[];
  isActive: boolean;
}
