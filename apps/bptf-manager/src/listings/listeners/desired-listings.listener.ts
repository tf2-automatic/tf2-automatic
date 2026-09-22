import { Injectable } from '@nestjs/common';
import { DesiredListingsService } from '../desired-listings.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  CurrentListingsCreateFailedEvent,
  CurrentListingsCreatedEvent,
  DesiredListingsCreatedEvent,
} from '../interfaces/events.interface';
import SteamID from 'steamid';

@Injectable()
export class DesiredListingsListener {
  constructor(
    private readonly desiredListingsService: DesiredListingsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('current-listings.failed', { suppressErrors: false })
  async currentListingsFailed(
    event: CurrentListingsCreateFailedEvent,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    // Update the failed desired listings with the error message
    await this.desiredListingsService.updateDesired(
      event.steamid,
      Object.keys(event.errors),
      (desired) =>
        desired.forEach((d) => {
          d.setUpdatedAt(now);
          d.setLastAttemptedAt(now);
          d.setError(event.errors[d.getHash()]);
        }),
    );
  }

  @OnEvent('current-listings.deleted-all', {
    suppressErrors: false,
  })
  async currentListingsDeletedAll(steamid: SteamID): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    const hashes =
      await this.desiredListingsService.getAllDesiredHashes(steamid);

    // Remove listing id from all desired listings
    await this.desiredListingsService.updateDesired(
      steamid,
      hashes,
      (desired) =>
        desired.forEach((d) => {
          d.setID(null);
          d.setUpdatedAt(now);
        }),
    );
  }

  @OnEvent('current-listings.created', {
    suppressErrors: false,
  })
  async currentListingsCreated(
    event: CurrentListingsCreatedEvent,
  ): Promise<void> {
    const createdHashes = Object.keys(event.listings);

    if (createdHashes.length === 0) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    // Save listings with their new listings id
    const desired = await this.desiredListingsService.updateDesired(
      event.steamid,
      createdHashes,
      (desired) =>
        desired.forEach((d) => {
          d.setID(event.listings[d.getHash()].id);
          d.setLastAttemptedAt(now);
          d.setUpdatedAt(now);
          d.setError(undefined);
        }),
    );

    // Emitted even when no desired listing is left: listings whose desired listing was removed
    // while they were being created are then queued for deletion by the created handlers
    this.eventEmitter.emit('desired-listings.created', {
      steamid: event.steamid,
      desired,
      listings: event.listings,
    } satisfies DesiredListingsCreatedEvent);
  }
}
