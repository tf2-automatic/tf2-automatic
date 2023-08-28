import SteamID from 'steamid';
import { DesiredListing, ListingError } from './desired-listing.interface';
import { Listing } from '@tf2-automatic/bptf-manager-data';

interface BaseDesiredListingsEvent {
  steamid: SteamID;
  listings: DesiredListing[];
}

export interface DesiredListingsAddedEvent extends BaseDesiredListingsEvent {}
export interface DesiredListingsRemovedEvent extends BaseDesiredListingsEvent {}
export interface DesiredListingsCreatedEvent extends BaseDesiredListingsEvent {}

export interface CurrentListingsCreatedEvent {
  steamid: SteamID;
  results: Record<string, Listing>;
}

export interface CurrentListingsCreateFailedEvent {
  steamid: SteamID;
  results: Record<string, ListingError>;
}

export interface CurrentListingsDeletedEvent {
  steamid: SteamID;
  ids: string[];
  isActive: boolean;
}
