import SteamID from 'steamid';
import { ExtendedDesiredListing } from './desired-listing.interface';
import { Listing, ListingError } from '@tf2-automatic/bptf-manager-data';

interface BaseDesiredListingsEvent {
  steamid: SteamID;
  desired: ExtendedDesiredListing[];
}

export interface DesiredListingsAddedEvent extends BaseDesiredListingsEvent {}
export interface DesiredListingsRemovedEvent extends BaseDesiredListingsEvent {}
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
