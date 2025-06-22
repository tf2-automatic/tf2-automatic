import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis';
import {
  CursorPaginationResponse,
  PricesSearchDto,
  SavePriceDto,
} from '@tf2-automatic/dto';
import {
  INVENTORY_LOADED_EVENT,
  InventoryLoadedEvent,
  ITEM_SERVICE_EXCHANGE_NAME,
  Price,
  PRICE_CREATED_EVENT,
  PRICE_DELETED_EVENT,
  PriceCreatedEvent,
  PriceDeletedEvent,
  PricelistAsset,
  PricesSearch,
  PricesSearchResponse,
  PriceWithAsset,
} from '@tf2-automatic/item-service-data';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import Redis, { ChainableCommander } from 'ioredis';
import { pack, unpack } from 'msgpackr';
import { SchemaService } from '../schema/schema.service';
import { Locker, LockDuration } from '@tf2-automatic/locking';
import {
  SKU,
  RequiredItemAttributes,
  Binary,
  Utils,
} from '@tf2-automatic/tf2-format';
import { RelayService } from '@tf2-automatic/nestjs-relay';
import assert from 'assert';
import { InventoriesService } from '../inventories/inventories.service';
import SteamID from 'steamid';

enum PricesKeys {
  PRICES = 'prices',
  NAME_INDEX = 'price-index-name',
  SKU_INDEX = 'price-index-sku',
  ASSET_INDEX = 'price-index-asset',
}

@Injectable()
export class PricesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PricesService.name);

  private readonly redis: Redis = this.redisService.getOrThrow();
  private readonly locker: Locker = new Locker(this.redis);

  constructor(
    private readonly redisService: RedisService,
    private readonly eventsService: NestEventsService,
    private readonly schemaService: SchemaService,
    private readonly relayService: RelayService,
    private readonly inventoriesService: InventoriesService,
  ) {}

  async onApplicationBootstrap() {
    await this.eventsService.subscribe<InventoryLoadedEvent>(
      'item-service.check-priced-assets',
      ITEM_SERVICE_EXCHANGE_NAME,
      [INVENTORY_LOADED_EVENT],
      async (event) => this.handleInventoryLoadedEvent(event),
      {
        retry: true,
      },
    );
  }

  private getKeyByItem(item: RequiredItemAttributes): string {
    const encoded = Binary.encode(item);
    const combined = Buffer.concat([Buffer.from('item:'), encoded]);

    return combined.toString('base64');
  }

  private getKeyByAsset(assetid: string): string {
    return Buffer.from('asset:' + assetid).toString('base64');
  }

  private async getItemByAsset(
    asset: PricelistAsset,
  ): Promise<RequiredItemAttributes | null> {
    const steamid = new SteamID(asset.owner);

    const item = await this.inventoriesService
      .getItemByAsset(steamid, asset.id)
      .catch((err) => {
        if (
          err instanceof NotFoundException &&
          err.message === 'Inventory not found'
        ) {
          return null;
        }

        throw err;
      });

    if (item === null) {
      this.inventoriesService.addJob(steamid).catch((err) => {
        this.logger.warn('Failed to add job', err);
      });
    }

    return item;
  }

  async savePrice(price: SavePriceDto): Promise<Price> {
    assert(price.item || price.asset, 'Either item or asset must be provided');

    let key: string;
    if (price.asset) {
      key = this.getKeyByAsset(price.asset.id);
    } else if (price.item) {
      Utils.compact(price.item);
      Utils.canonicalize(price.item);
      price.item = Utils.order(price.item);
      key = this.getKeyByItem(price.item);
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
          item: price.item !== undefined ? price.item : null,
          name: null,
          asset: price.asset,
          buy: price.buy,
          sell: price.sell,
          min: price.min,
          max: price.max,
          createdAt: now,
          updatedAt: now,
        };

        const multi = this.redis.multi();

        let current: Price | null = null;

        if (currentRaw) {
          current = unpack(currentRaw) as Price;
          save.createdAt = current.createdAt;
          save.item = current.item;
        }

        let throwOnceDone: Error | null = null;

        if (price.asset) {
          // Check if the asset is in the inventory
          const item = await this.getItemByAsset(price.asset).catch((err) => {
            if (
              err instanceof NotFoundException &&
              err.message === 'Asset not found'
            ) {
              return err;
            }

            throw err;
          });

          if (item instanceof Error) {
            if (!current) {
              throw item;
            }

            // Asset is not in the inventory and it is already priced
            this.deletePriceMulti(multi, current);
            throwOnceDone = item;
          } else if (item !== null) {
            save.item = item;
          }

          if (signal.aborted) {
            throw signal.error;
          }
        }

        if (!throwOnceDone) {
          if (save.item !== null) {
            await this.updateName(save);
            if (signal.aborted) {
              throw signal.error;
            }
          }

          // Store the new price
          this.savePriceMulti(multi, save, current);
        }

        await multi.exec();

        if (throwOnceDone) {
          throw throwOnceDone;
        }

        return save;
      },
    );
  }

  private async updateName(price: Price): Promise<void> {
    if (price.item !== null) {
      const naming = this.schemaService.getNameGenerator();
      price.name = await naming.getName(price.item);
    }
  }

  private savePriceMulti(
    multi: ChainableCommander,
    price: Price,
    old?: Price | null,
  ) {
    if (old) {
      // Clean up old price
      if (old.name) {
        multi.srem(PricesKeys.NAME_INDEX + ':' + old.name, old.id);
      }
      if (old.item) {
        multi.srem(
          PricesKeys.SKU_INDEX + ':' + SKU.fromObject(old.item),
          old.id,
        );
      }
    }

    // Store the new price
    multi.hset(PricesKeys.PRICES, price.id, pack(price));

    if (price.name) {
      multi.sadd(PricesKeys.NAME_INDEX + ':' + price.name, price.id);
    }
    if (price.item) {
      multi.sadd(
        PricesKeys.SKU_INDEX + ':' + SKU.fromObject(price.item),
        price.id,
      );
    }
    if (price.asset) {
      multi.sadd(PricesKeys.ASSET_INDEX + ':' + price.asset.owner, price.id);
      multi.sadd(PricesKeys.ASSET_INDEX, price.id);
    }

    this.relayService.publishEvent(
      multi,
      PRICE_CREATED_EVENT,
      price satisfies PriceCreatedEvent['data'],
    );
  }

  async deletePrice(key: string): Promise<void> {
    return this.deletePrices([key]);
  }

  async deletePrices(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    await this.locker.using(keys, LockDuration.SHORT, async (signal) => {
      const multi = this.redis.multi();

      const result = await this.redis.hmgetBuffer(PricesKeys.PRICES, ...keys);

      if (signal.aborted) {
        throw signal.error;
      }

      for (const raw of result) {
        if (raw === null) {
          continue;
        }

        const current = unpack(raw) as Price;
        this.deletePriceMulti(multi, current);
      }

      await multi.exec();
    });
  }

  private deletePriceMulti(multi: ChainableCommander, current: Price) {
    if (current.name) {
      multi.srem(PricesKeys.NAME_INDEX + current.name, current.id);
    }
    if (current.item) {
      multi.srem(
        PricesKeys.SKU_INDEX + ':' + SKU.fromObject(current.item),
        current.id,
      );
    }
    if (current.asset) {
      multi.srem(
        PricesKeys.ASSET_INDEX + ':' + current.asset.owner,
        current.id,
      );
      multi.srem(PricesKeys.ASSET_INDEX, current.id);
    }

    multi.hdel(PricesKeys.PRICES, current.id);

    this.relayService.publishEvent(
      multi,
      PRICE_DELETED_EVENT,
      current satisfies PriceDeletedEvent['data'],
    );
  }

  async getPrices(dto: PricesSearchDto) {
    const hasPagination = new Boolean(dto.cursor || dto.count);
    const hasSearch = new Boolean(dto.assetid || dto.name || dto.sku);

    assert(hasPagination && hasSearch, 'Cannot use both pagination and search');

    if (!dto.name && !dto.sku && !dto.assetid) {
      return this.getHashesPaginated<Price>(dto.cursor, dto.count);
    }

    return this.searchPrices(dto);
  }

  private async getHashesPaginated<T>(
    cursor = 0,
    count = 1000,
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

  private async handleInventoryLoadedEvent(event: InventoryLoadedEvent) {
    // Check if this inventory has priced assets

    const pricedAssets = await this.redis.smembers(
      PricesKeys.ASSET_INDEX + ':' + event.data.steamid64,
    );

    if (pricedAssets.length === 0) {
      return;
    }

    await this.locker.using(
      Array.from(pricedAssets),
      LockDuration.MEDIUM,
      async (signal) => {
        const prices = await this.redis.hmgetBuffer(
          PricesKeys.PRICES,
          ...pricedAssets,
        );

        if (signal.aborted) {
          throw signal.error;
        }

        const steamid = new SteamID(event.data.steamid64);

        const inventory = await this.inventoriesService
          .getInventoryItemsFromCache(steamid)
          .catch((err) => {
            if (err instanceof NotFoundException) {
              return null;
            }

            throw err;
          });

        if (inventory === null) {
          return;
        }

        if (signal.aborted) {
          throw signal.error;
        }

        const pricesToSave: PriceWithAsset[] = [];
        const pricesToDelete: PriceWithAsset[] = [];

        const keys = new Set<string>();

        for (const raw of prices) {
          if (raw === null) {
            continue;
          }

          const price = unpack(raw) as PriceWithAsset;

          if (price.item === null) {
            // Look for the sku in the inventory
            const item = inventory.items[price.asset.id];
            if (item === undefined) {
              keys.add(price.id);
              pricesToDelete.push(price);
            } else {
              Utils.compact(item);
              price.item = Utils.order(item);

              await this.updateName(price);

              keys.add(price.id);
              pricesToSave.push(price);
            }
          }
        }

        if (pricesToDelete.length === 0 && pricesToSave.length === 0) {
          return;
        }

        if (signal.aborted) {
          throw signal.error;
        }

        this.logger.debug(
          'Inventory was loaded and assets were checked. Updating ' +
            pricesToSave.length +
            ' and deleting ' +
            pricesToDelete.length +
            ' price(s).',
        );

        const multi = this.redis.multi();

        for (const price of pricesToDelete) {
          this.deletePriceMulti(multi, price);
        }

        for (const price of pricesToSave) {
          const now = Math.floor(Date.now() / 1000);

          const save: Price = {
            id: price.id,
            item: price.item ?? null,
            name: price.name,
            asset: price.asset,
            buy: price.buy,
            sell: price.sell,
            min: price.min,
            max: price.max,
            createdAt: now,
            updatedAt: now,
          };

          save.createdAt = price.createdAt;
          save.item = price.item;

          this.savePriceMulti(multi, save, price);
        }

        await multi.exec();
      },
    );
  }
}
