import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRedis } from '@songkeys/nestjs-redis';
import { CursorPaginationResponse, SavePriceDto } from '@tf2-automatic/dto';
import {
  Price,
  PRICE_CREATED_EVENT,
  PRICE_DELETED_EVENT,
  PriceCreatedEvent,
  PriceDeletedEvent,
} from '@tf2-automatic/item-service-data';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import Redis from 'ioredis';
import { pack, unpack } from 'msgpackr';
import { SchemaService } from '../schema/schema.service';
import { Locker, LockDuration } from '@tf2-automatic/locking';
import { SKU } from '@tf2-automatic/tf2-format';
import { RelayService } from '@tf2-automatic/nestjs-relay';

enum PricesKeys {
  PRICES = 'prices',
  INDEX = 'price-index',
}

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);

  private readonly locker: Locker;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly eventsService: NestEventsService,
    private readonly schemaService: SchemaService,
    private readonly relayService: RelayService,
  ) {
    this.locker = new Locker(redis);
  }

  private getKeyBySKU(sku: string): string {
    return Buffer.from('sku:' + sku).toString('base64');
  }

  private getKeyByAsset(assetid: string): string {
    return Buffer.from('asset:' + assetid).toString('base64');
  }

  async savePrice(price: SavePriceDto): Promise<Price> {
    const key = price.asset
      ? this.getKeyByAsset(price.asset.id)
      : this.getKeyBySKU(price.sku);

    const naming = this.schemaService.getNameGenerator();
    const item = SKU.fromString(price.sku);

    const namePromise = naming.getName(item);

    return this.locker.using(
      [PricesKeys.PRICES + ':' + key],
      LockDuration.SHORT,
      async (signal) => {
        const currentRaw = await this.redis.hgetBuffer(PricesKeys.PRICES, key);

        if (signal.aborted) {
          throw signal.error;
        }

        // This might be unnessesary but we might aswell generate the name while we are acquirinq a lock
        // The idea is that saving prices should be very fast.
        const name = await namePromise;

        if (signal.aborted) {
          throw signal.error;
        }

        const now = Math.floor(Date.now() / 1000);

        const save: Price = {
          id: key,
          sku: price.sku,
          name,
          asset: price.asset,
          buy: price.buy,
          sell: price.sell,
          createdAt: now,
          updatedAt: now,
        };

        const multi = this.redis.multi();

        if (currentRaw) {
          const current = unpack(currentRaw) as Price;
          save.createdAt = current.createdAt;
          console.log(current);
          // Remove current name from index because the schema might have changed since last we priced the item
          multi.srem(PricesKeys.INDEX + ':' + current.name, key);
        }

        // Store the new price
        multi.hset(PricesKeys.PRICES, key, pack(save));

        // Add the new name to the index and reference the new price
        multi.sadd(PricesKeys.INDEX + ':' + save.name, key);

        // TODO: Add asset to another key so that we can easily check if the asset is still in the inventory and remove it if it is not.

        this.relayService.publishEvent(
          multi,
          PRICE_CREATED_EVENT,
          save satisfies PriceCreatedEvent['data'],
        );

        await multi.exec();

        return save;
      },
    );
  }

  async deletePrice(key: string): Promise<void> {
    await this.locker.using([key], LockDuration.SHORT, async (signal) => {
      const raw = await this.redis.hgetBuffer('prices', key);
      if (!raw) {
        return;
      }

      if (signal.aborted) {
        throw signal.error;
      }

      const multi = this.redis.multi();

      const current = unpack(raw) as Price;
      multi.srem(PricesKeys.INDEX + current.name, key);
      multi.hdel(PricesKeys.PRICES, key);

      this.relayService.publishEvent(
        multi,
        PRICE_DELETED_EVENT,
        current satisfies PriceDeletedEvent['data'],
      );

      await multi.exec();
    });
  }

  async getPrices(cursor: number, count: number): Promise<unknown> {
    return this.getHashesPaginated<Price>(cursor, count);
  }

  private async getHashesPaginated<T>(
    cursor: number,
    count: number,
  ): Promise<CursorPaginationResponse<T>> {
    const [newCursor, elements] = await this.redis.hscanBuffer(
      PricesKeys.PRICES,
      cursor,
      'COUNT',
      count,
    );

    const items: T[] = [];

    for (let i = 0; i < elements.length; i += 2) {
      items.push(unpack(elements[i + 1]));
    }

    const next = parseInt(newCursor.toString('utf8'), 10);

    return {
      current: cursor,
      next: next === 0 ? null : next,
      items,
    };
  }

  async getPrice(id: string): Promise<Price> {
    const raw = await this.redis.hgetBuffer(PricesKeys.PRICES, id);
    if (!raw) {
      throw new NotFoundException('Price not found');
    }

    return unpack(raw) as Price;
  }

  async getPriceByName(name: string): Promise<Price[]> {
    const members = await this.redis.smembers(PricesKeys.INDEX + ':' + name);
    if (members.length === 0) {
      return [];
    }

    const currentRaw = await this.redis.hmgetBuffer(
      PricesKeys.PRICES,
      ...members,
    );

    const current: Price[] = [];

    for (let i = 0; i < currentRaw.length; i++) {
      const raw = currentRaw[i];
      if (raw !== null) {
        current.push(unpack(raw));
      }
    }

    // Ensure that price without asset is always first
    current.sort((a, b) => {
      if (a.asset && !b.asset) {
        return 1;
      }
      if (!a.asset && b.asset) {
        return -1;
      }
      return 0;
    });

    return current;
  }
}
