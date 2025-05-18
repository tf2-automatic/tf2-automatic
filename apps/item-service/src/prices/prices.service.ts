import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRedis } from '@songkeys/nestjs-redis';
import {
  CursorPaginationResponse,
  PricesSearchDto,
  SavePriceDto,
} from '@tf2-automatic/dto';
import {
  Price,
  PRICE_CREATED_EVENT,
  PRICE_DELETED_EVENT,
  PriceCreatedEvent,
  PriceDeletedEvent,
  PricesSearch,
  PricesSearchResponse,
} from '@tf2-automatic/item-service-data';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import Redis from 'ioredis';
import { pack, unpack } from 'msgpackr';
import { SchemaService } from '../schema/schema.service';
import { Locker, LockDuration } from '@tf2-automatic/locking';
import { SKU } from '@tf2-automatic/tf2-format';
import { RelayService } from '@tf2-automatic/nestjs-relay';
import assert from 'assert';

enum PricesKeys {
  PRICES = 'prices',
  NAME_INDEX = 'price-index-name',
  SKU_INDEX = 'price-index-sku',
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
    assert(price.sku || price.asset, 'Either sku or asset must be provided');

    let key: string;
    if (price.asset) {
      key = this.getKeyByAsset(price.asset.id);
    } else if (price.sku) {
      key = this.getKeyBySKU(price.sku);
    } else {
      assert(false, 'No sku or asset provided');
    }

    return this.locker.using(
      [PricesKeys.PRICES + ':' + key],
      LockDuration.SHORT,
      async (signal) => {
        const currentRaw = await this.redis.hgetBuffer(PricesKeys.PRICES, key);

        if (signal.aborted) {
          throw signal.error;
        }

        const now = Math.floor(Date.now() / 1000);

        const save: Price = {
          id: key,
          sku: price.sku ?? null,
          name: null,
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
          save.sku = current.sku;

          // We don't inherit the name because the schema might have changed

          multi.srem(PricesKeys.NAME_INDEX + ':' + current.name, key);
          multi.srem(PricesKeys.SKU_INDEX + ':' + current.sku, key);
        }

        /*
        TODO: If price is for an asset, then check if the inventory is loaded and if the asset is in it.

        - If it is in the inventory, then we copy the sku
        - If it is not in the inventory, then we throw a 4xx error
        - If the inventory is not loaded then we just continue
        */

        if (save.sku !== null) {
          const naming = this.schemaService.getNameGenerator();
          const item = SKU.fromString(save.sku);

          save.name = await naming.getName(item);

          if (signal.aborted) {
            throw signal.error;
          }
        }

        // Store the new price
        multi.hset(PricesKeys.PRICES, key, pack(save));

        multi.sadd(PricesKeys.NAME_INDEX + ':' + save.name, key);
        multi.sadd(PricesKeys.SKU_INDEX + ':' + save.sku, key);

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
      multi.srem(PricesKeys.NAME_INDEX + current.name, key);
      multi.srem(PricesKeys.SKU_INDEX + current.sku, key);
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

  async searchPrices(dto: PricesSearchDto): Promise<PricesSearchResponse> {
    const chainable = this.redis.pipeline();
    const order: { key: keyof typeof dto; value: string }[] = [];

    if (dto.name) {
      for (let i = 0; i < dto.name.length; i++) {
        const name = dto.name[i];
        order.push({ key: 'name', value: name });
        chainable.smembers(`${PricesKeys.NAME_INDEX}:${name}`);
      }
    }

    if (dto.sku) {
      for (let i = 0; i < dto.sku.length; i++) {
        const sku = dto.sku[i];
        order.push({ key: 'sku', value: sku });
        chainable.smembers(`${PricesKeys.SKU_INDEX}:${sku}`);
      }
    }

    const results = await chainable.exec();
    if (results === null) {
      throw new Error('Pipeline returned null');
    }

    assert(results.length === order.length, 'Length mismatch');

    const keys = new Set<string>();

    const matches: Partial<
      Record<keyof PricesSearch, Record<string, string[]>>
    > = {};

    if (dto.assetid) {
      const assetidMatches = (matches.assetid = {});
      dto.assetid.forEach((assetid) => {
        const key = this.getKeyByAsset(assetid);
        keys.add(key);
        assetidMatches[assetid] = [key];
      });
    }

    results.forEach(([err, result], i) => {
      if (err) {
        return;
      }

      const ids = result as string[];
      const { key, value } = order[i];

      matches[key] = matches[key] ?? {};
      matches[key][value] = ids;

      ids.forEach((id) => keys.add(id));
    });

    const keysArray = Array.from(keys);
    const items: Price[] = [];
    const idToIndex: Record<string, number> = {};

    if (keysArray.length > 0) {
      const rawItems = await this.redis.hmgetBuffer(
        PricesKeys.PRICES,
        ...keysArray,
      );
      rawItems.forEach((raw) => {
        if (raw === null) {
          return;
        }

        const item = unpack(raw) as Price;
        idToIndex[item.id] = items.length;
        items.push(item);
      });
    }

    const newMatches: PricesSearchResponse['matches'] = {};
    for (const type in matches) {
      newMatches[type] = {};
      for (const key in matches[type]) {
        newMatches[type][key] = [];
        for (const id of matches[type][key]) {
          if (id in idToIndex) {
            newMatches[type][key].push(idToIndex[id]);
          }
        }
      }
    }

    return { matches: newMatches, items };
  }
}
