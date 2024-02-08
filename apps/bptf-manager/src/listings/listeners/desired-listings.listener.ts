import { Injectable } from '@nestjs/common';
import { DesiredListingsService } from '../desired-listings.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  CurrentListingsCreateFailedEvent,
  CurrentListingsCreatedEvent,
  DesiredListingsCreatedEvent,
} from '../interfaces/events.interface';
import { Redis } from 'ioredis';
import { InjectRedis } from '@songkeys/nestjs-redis';
import SteamID from 'steamid';

@Injectable()
export class DesiredListingsListener {
  constructor(
    private readonly desiredListingsService: DesiredListingsService,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('current-listings.failed', { suppressErrors: false })
  async currentListingsFailed(
    event: CurrentListingsCreateFailedEvent,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    const failedHashes = Object.keys(event.errors);

    // Update the failed desired listings with the error message
    const map = await this.desiredListingsService.getDesiredByHashesNew(
      event.steamid,
      failedHashes,
    );

    if (map.size === 0) {
      return;
    }

    const desired = Array.from(map.values());
    desired.forEach((desired) => {
      desired.setUpdatedAt(now);
      desired.setLastAttemptedAt(now);
      desired.setError(event.errors[desired.getHash()]);
    });

    const transaction = this.redis.multi();
    DesiredListingsService.chainableSaveDesired(
      transaction,
      event.steamid,
      desired,
    );
    await transaction.exec();
  }

  @OnEvent('current-listings.deleted-all', {
    suppressErrors: false,
  })
  async currentListingsDeletedAll(steamid: SteamID): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    const desired =
      await this.desiredListingsService.getAllDesiredInternalNew(steamid);

    if (desired.length === 0) {
      return;
    }

    // Remove listing id from all desired listings
    desired.forEach((d) => {
      d.setID(null);
      d.setUpdatedAt(now);
    });

    const transaction = this.redis.multi();
    DesiredListingsService.chainableSaveDesired(transaction, steamid, desired);
    await transaction.exec();
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

    // Update desired listings that were changed
    const hashes = Object.keys(event.listings);

    const map = await this.desiredListingsService.getDesiredByHashesNew(
      event.steamid,
      hashes,
    );

    if (map.size === 0) {
      return;
    }

    const desired = Array.from(map.values());
    desired.forEach((desired) => {
      desired.setID(event.listings[desired.getHash()].id);
      desired.setLastAttemptedAt(now);
      desired.setUpdatedAt(now);
      desired.setError(undefined);
    });

    const transaction = this.redis.multi();

    // Save listings with their new listings id
    DesiredListingsService.chainableSaveDesired(
      transaction,
      event.steamid,
      desired,
    );

    await transaction.exec();

    await this.eventEmitter.emitAsync('desired-listings.created', {
      steamid: event.steamid,
      desired: desired.map((d) => d.toJSON()),
      listings: event.listings,
    } satisfies DesiredListingsCreatedEvent);
  }
}
