import { InjectRedis } from '@songkeys/nestjs-redis';
import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
  RequestTimeoutException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  BOT_EXCHANGE_NAME,
  ExchangeDetailsItem,
  INVENTORIES_BASE_URL,
  Inventory,
  INVENTORY_PATH,
  Item,
  TF2LostEvent,
  TF2_LOST_EVENT,
  TradeChangedEvent,
  TRADE_CHANGED_EVENT,
  TF2_GAINED_EVENT,
  TF2GainedEvent,
} from '@tf2-automatic/bot-data';
import {
  Bot,
  BOT_MANAGER_EXCHANGE_NAME,
  ExchangeDetailsEvent,
  EXCHANGE_DETAILS_EVENT,
  InventoryLoadedEvent,
  INVENTORY_LOADED_EVENT,
  InventoryResponse,
  INVENTORY_CHANGED_EVENT,
  InventoryChangedEvent,
  InventoryChangedEventReason,
  InventoryItem,
} from '@tf2-automatic/bot-manager-data';
import { Redis } from 'ioredis';
import { firstValueFrom } from 'rxjs';
import SteamUser from 'steam-user';
import SteamID from 'steamid';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import { EnqueueInventoryDto } from '@tf2-automatic/dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue, QueueEvents } from 'bullmq';
import { InventoryQueue } from './interfaces/queue.interfaces';
import { v4 as uuidv4 } from 'uuid';
import { redisMultiEvent } from '../common/utils/redis-multi-event';
import { LockDuration, Locker } from '@tf2-automatic/locking';
import { pack, unpack } from 'msgpackr';

interface InventoryIdentifier {
  steamid64: string;
  appid: number;
  contextid: string;
}

export const INVENTORY_EXPIRE_TIME = 600;

@Injectable()
export class InventoriesService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly locker: Locker;

  private readonly inventoryQueueEvents = new QueueEvents(
    this.inventoriesQueue.name,
    {
      autorun: true,
      prefix: this.inventoriesQueue.opts.prefix,
      connection: this.inventoriesQueue.opts.connection,
    },
  );

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
    private readonly httpService: HttpService,
    private readonly eventsService: NestEventsService,
    @InjectQueue('inventories')
    private readonly inventoriesQueue: Queue<InventoryQueue>,
  ) {
    this.locker = new Locker(this.redis);
  }

  async onApplicationBootstrap() {
    // TODO: For some reason we can't do `autorun: false` and then call
    // `this.inventoryQueueEvents.run()`

    await this.eventsService.subscribe(
      'bot-manager.delete-inventory-items',
      BOT_EXCHANGE_NAME,
      [TF2_LOST_EVENT, TF2_GAINED_EVENT, TRADE_CHANGED_EVENT],
      (event) => this.handleDeleteInventoryItems(event as any),
      {
        retry: true,
      },
    );

    await this.eventsService.subscribe(
      'bot-manager.update-inventory-items',
      BOT_MANAGER_EXCHANGE_NAME,
      [EXCHANGE_DETAILS_EVENT],
      (event) => this.handleAddInventoryItems(event as any),
      {
        retry: true,
      },
    );
  }

  async onModuleDestroy() {
    return this.inventoryQueueEvents.close();
  }

  async addToQueue(
    steamid: SteamID,
    appid: number,
    contextid: string,
    dto: EnqueueInventoryDto,
  ): Promise<Job<InventoryQueue>> {
    const data: InventoryQueue = {
      raw: {
        steamid64: steamid.getSteamID64(),
        appid,
        contextid,
      },
      extra: {},
      bot: dto.bot,
      retry: dto.retry,
      ttl: dto.ttl,
    };

    const id = this.getInventoryJobId(steamid, appid, contextid);

    return this.inventoriesQueue.add(id, data, {
      jobId: id,
      backoff: {
        type: 'custom',
      },
    });
  }

  private async fetchInventoryFromBot(
    bot: Bot,
    steamid: SteamID,
    appid: number,
    contextid: string,
  ): Promise<Inventory> {
    const response = await firstValueFrom(
      this.httpService.get<Inventory>(
        `http://${bot.ip}:${bot.port}${INVENTORIES_BASE_URL}${INVENTORY_PATH}`
          .replace(':steamid', steamid.getSteamID64())
          .replace(':appid', appid.toString())
          .replace(':contextid', contextid),
        { params: { tradableOnly: false } },
      ),
    );

    return response.data;
  }

  async getInventoryFromBot(
    bot: Bot,
    steamid: SteamID,
    appid: number,
    contextid: string,
    ttl: number = INVENTORY_EXPIRE_TIME,
  ): Promise<InventoryResponse> {
    const now = Math.floor(Date.now() / 1000);

    const items = await this.fetchInventoryFromBot(
      bot,
      steamid,
      appid,
      contextid,
    );

    const object = items.reduce((acc, item) => {
      acc[`item:${item.assetid}`] = pack(item);
      return acc;
    }, {});

    object['timestamp'] = now;

    const key = this.getInventoryKey(steamid, appid, contextid);
    const tempKey = key + ':temp';

    const event = {
      steamid64: steamid.getSteamID64(),
      appid,
      contextid,
      timestamp: now,
      itemCount: items.length,
    } satisfies InventoryLoadedEvent['data'];

    // Save inventory in Redis and event in outbox
    await this.locker.using(
      [
        this.getInventoryResource({
          steamid64: steamid.getSteamID64(),
          appid,
          contextid,
        }),
      ],
      LockDuration.SHORT,
      async () => {
        await this.redis.hset(tempKey, object);

        const multi = this.redis.multi().rename(tempKey, key);

        redisMultiEvent(multi, {
          type: INVENTORY_LOADED_EVENT,
          data: event,
          metadata: {
            id: uuidv4(),
            steamid64: event.steamid64,
            time: Math.floor(Date.now() / 1000),
          },
        } satisfies InventoryLoadedEvent);

        if (ttl > 0) {
          // and make it expire
          multi.expire(key, ttl);
        }

        await multi.exec();
      },
    );

    return {
      timestamp: now,
      ttl,
      items,
    };
  }

  async deleteInventory(
    steamid: SteamID,
    appid: number,
    contextid: string,
  ): Promise<void> {
    await this.inventoriesQueue.remove(
      this.getInventoryJobId(steamid, appid, contextid),
    );

    return this.locker.using(
      [
        this.getInventoryResource({
          steamid64: steamid.getSteamID64(),
          appid,
          contextid,
        }),
      ],
      LockDuration.SHORT,
      async () => {
        await this.redis.del(this.getInventoryKey(steamid, appid, contextid));
      },
    );
  }

  async fetchInventory(
    steamid: SteamID,
    appid: number,
    contextid: string,
    useCache = true,
    tradableOnly = true,
    ttl?: number,
  ): Promise<InventoryResponse> {
    if (useCache) {
      try {
        const inventory = await this.getInventoryFromCache(
          steamid,
          appid,
          contextid,
          tradableOnly,
        );

        return inventory;
      } catch (err) {
        if (!(err instanceof NotFoundException)) {
          throw err;
        }

        // Inventory is not in the cache
      }
    }

    // Add the job to the queue. I believe that if it is already in the queue
    // then it will not be replaced
    const job = await this.addToQueue(steamid, appid, contextid, {
      ttl: ttl ?? INVENTORY_EXPIRE_TIME,
    });

    // Wait for it to finish
    await job
      .waitUntilFinished(this.inventoryQueueEvents, 10000)
      .catch((err: Error) => {
        if (
          err.message.startsWith(
            'Job wait ' + job.id! + ' timed out before finishing',
          )
        ) {
          throw new RequestTimeoutException(
            'Inventory was not fetched in time',
          );
        } else if (err.message === 'Inventory is private') {
          throw new UnauthorizedException('Inventory is private');
        }

        throw err;
      });

    return this.getInventoryFromCache(steamid, appid, contextid, tradableOnly);
  }

  async getInventoryFromCache(
    steamid: SteamID,
    appid: number,
    contextid: string,
    tradableOnly = true,
  ): Promise<InventoryResponse> {
    const inventory = await this.fetchInventoryFromCache(
      steamid,
      appid,
      contextid,
    );

    const items = tradableOnly
      ? inventory.items.filter((item) => item?.tradable === true)
      : inventory.items;

    return {
      timestamp: inventory.timestamp,
      ttl: inventory.ttl,
      items,
    };
  }

  private async fetchInventoryFromCache(
    steamid: SteamID,
    appid: number,
    contextid: string,
  ): Promise<InventoryResponse> {
    const key = this.getInventoryKey(steamid, appid, contextid);

    const { timestamp, ttl, object } = await this.locker.using(
      [
        this.getInventoryResource({
          steamid64: steamid.getSteamID64(),
          appid,
          contextid,
        }),
      ],
      LockDuration.SHORT,
      async (signal) => {
        const timestamp = await this.redis.hget(key, 'timestamp');
        if (timestamp === null) {
          // Inventory is not in the cache
          throw new NotFoundException('Inventory not found');
        }

        if (signal.aborted) {
          throw signal.error;
        }

        const [object, ttl] = await Promise.all([
          this.redis.hgetallBuffer(key),
          this.redis.ttl(key),
        ]);

        return { timestamp: parseInt(timestamp, 10), ttl, object };
      },
    );

    const items = Object.keys(object)
      .filter((key) => {
        return key.startsWith('item:');
      })
      .map((item) => unpack(object[item]));

    return {
      timestamp,
      ttl,
      items,
    };
  }

  private handleDeleteInventoryItems(
    event: TF2LostEvent | TradeChangedEvent | TF2GainedEvent,
  ): Promise<void> {
    switch (event.type) {
      case TRADE_CHANGED_EVENT:
        return this.handleOfferChanged(event);
      case TF2_LOST_EVENT:
        return this.handleItemLost(event);
      case TF2_GAINED_EVENT:
        return this.handleItemGained(event);
    }
  }

  private addAssetIds(
    result: Record<string, string[]>,
    steamid: SteamID,
    appid: number,
    contextid: string,
    assetids: string[],
  ) {
    assetids.forEach((assetid) => {
      const key = pack({
        steamid64: steamid.getSteamID64(),
        appid: appid,
        contextid: contextid,
      } satisfies InventoryIdentifier).toString('base64');

      result[key] = result[key] ?? [];
      result[key].push(assetid);
    });
  }

  private addItems(
    result: Record<string, InventoryItem[]>,
    steamid: SteamID,
    items: InventoryItem[],
  ) {
    items.reduce((acc, cur) => {
      const key = pack({
        steamid64: steamid.getSteamID64(),
        appid: cur.appid,
        contextid: cur.contextid,
      } satisfies InventoryIdentifier).toString('base64');

      acc[key] = acc[key] ?? [];
      acc[key].push(cur);
      return acc;
    }, result);
  }

  private async handleAddInventoryItems(
    event: ExchangeDetailsEvent,
  ): Promise<void> {
    const gainedItems: Record<string, Item[]> = {};
    const lostItems: Record<string, string[]> = {};

    const ourSteamID = new SteamID(event.metadata.steamid64 as string);
    const theirSteamID = new SteamID(event.data.offer.partner);

    const receivedItems = event.data.details.receivedItems;
    const sentItems = event.data.details.sentItems;

    const addItems = (
      // Account that received the items
      receiver: SteamID,
      // Account that sent the items
      sender: SteamID,
      items: ExchangeDetailsItem[],
    ) => {
      items.forEach((item) => {
        if (item.rollback_new_assetid || item.rollback_new_contextid) {
          // Item is rolled back, it is moved from receiver to sender

          // Delete item by old assetid
          this.addAssetIds(lostItems, receiver, item.appid, item.contextid, [
            item.assetid,
          ]);

          if (item.rollback_new_assetid) {
            item.assetid = item.rollback_new_assetid;
            item.id = item.assetid;
            delete item.rollback_new_assetid;
          }

          if (item.rollback_new_contextid) {
            item.contextid = item.rollback_new_contextid;
            delete item.rollback_new_contextid;
          }

          delete item.new_assetid;
          delete item.new_contextid;

          // Add item using new assetid and contextid
          this.addItems(gainedItems, sender, [item]);
        } else if (item.new_assetid || item.new_contextid) {
          // Item is moved from sender to receiver

          // Delete item by old assetid
          this.addAssetIds(lostItems, receiver, item.appid, item.contextid, [
            item.assetid,
          ]);

          if (item.new_assetid) {
            item.assetid = item.new_assetid;
            item.id = item.assetid;
            delete item.new_assetid;
          }

          if (item.new_contextid) {
            item.contextid = item.new_contextid;
            delete item.new_contextid;
          }

          // Add item using new assetid and contextid
          this.addItems(gainedItems, receiver, [item]);
        }
      });
    };

    // We are the owner of the received items, and the partner is the owner of the sent items
    addItems(ourSteamID, theirSteamID, receivedItems);
    addItems(theirSteamID, ourSteamID, sentItems);

    return this.updateInventories(
      lostItems,
      gainedItems,
      InventoryChangedEventReason.ExchangeDetails,
    );
  }

  private async updateInventories(
    lostItems: Record<string, string[]>,
    gainedItems: Record<string, InventoryItem[]>,
    reason: InventoryChangedEventReason,
  ) {
    const inventories = Object.keys(lostItems)
      .concat(Object.keys(gainedItems))
      .reduce((acc, item) => {
        acc.add(item);
        return acc;
      }, new Set<string>());

    const resources = Array.from(inventories).map((inventory) => {
      const parts = unpack(Buffer.from(inventory, 'base64'));
      return this.getInventoryResource(parts);
    });

    return this.locker.using(resources, LockDuration.LONG, async (signal) => {
      // Check if cached inventories exist for the given items
      const inventoriesExists = await Promise.all(
        Object.keys(gainedItems).map((key) =>
          this.redis.exists(
            this.getInventoryKeyFromObject(unpack(Buffer.from(key, 'base64'))),
          ),
        ),
      );

      if (signal.aborted) {
        throw signal.error;
      }

      const multi = this.redis.multi();

      // Add gained items to the cached inventories
      Object.keys(gainedItems)
        // Only add items to inventories that are already cached
        .filter((_, i) => inventoriesExists[i])
        .forEach((inventory) => {
          const items = gainedItems[inventory];

          const key = this.getInventoryKeyFromObject(
            unpack(Buffer.from(inventory, 'base64')),
          );

          // Add the items to the cached inventories
          multi.hmset(
            key,
            ...items.map((item) => ['item:' + item.assetid, pack(item)]).flat(),
          );
        });

      const changes: Record<
        string,
        { gained: InventoryItem[]; lost: InventoryItem[] }
      > = {};

      Object.keys(gainedItems).forEach((key) => {
        changes[key] = changes[key] ?? { gained: [], lost: [] };
        changes[key].gained.push(...gainedItems[key]);
      });

      // Get lost items from the cached inventories
      await Promise.all(
        Object.keys(lostItems).map((key) => {
          const parts = unpack(
            Buffer.from(key, 'base64'),
          ) as InventoryIdentifier;

          return (
            this.redis
              // Get the items from the cached inventories
              .hmgetBuffer(
                this.getInventoryKeyFromObject(parts),
                ...lostItems[key].map((assetid) => 'item:' + assetid),
              )
              .then((raw) => {
                // Filter out null values and parse the items
                const items = raw
                  .filter((item) => {
                    return item !== null;
                  })
                  .map((item) => unpack(item));

                // Add the items to the changes object
                changes[key] = changes[key] ?? { gained: [], lost: [] };
                changes[key].lost.push(...items);
              })
          );
        }),
      );

      if (signal.aborted) {
        throw signal.error;
      }

      // Delete the items from the cached inventories
      Object.keys(lostItems).forEach((key) =>
        multi.hdel(
          this.getInventoryKeyFromObject(unpack(Buffer.from(key, 'base64'))),
          ...lostItems[key].map((assetid) => 'item:' + assetid),
        ),
      );

      const changedEvents: InventoryChangedEvent['data'][] = [];

      Object.keys(changes).forEach((key) => {
        const parts = unpack(Buffer.from(key, 'base64')) as InventoryIdentifier;
        const change = changes[key];

        if (change.gained.length === 0 && change.lost.length === 0) {
          return;
        }

        changedEvents.push({
          steamid64: parts.steamid64,
          appid: parts.appid,
          contextid: parts.contextid,
          gained: change.gained,
          lost: change.lost,
          reason,
        });
      });

      for (let i = 0; i < changedEvents.length; i++) {
        const data = changedEvents[i];

        redisMultiEvent(multi, {
          type: INVENTORY_CHANGED_EVENT,
          data,
          metadata: {
            id: uuidv4(),
            steamid64: data.steamid64,
            time: Math.floor(Date.now() / 1000),
          },
        } satisfies InventoryChangedEvent);
      }

      await multi.exec();
    });
  }

  private async handleOfferChanged(event: TradeChangedEvent): Promise<void> {
    if (
      event.data.offer.state !== SteamUser.ETradeOfferState.Accepted &&
      event.data.offer.state !== SteamUser.ETradeOfferState.InEscrow
    ) {
      return;
    }

    const ourSteamID = new SteamID(event.metadata.steamid64 as string);
    const theirSteamID = new SteamID(event.data.offer.partner);

    // Create an object of inventory keys which each contains an array of items to delete
    const lostItems: Record<string, string[]> = {};

    // Add items to the object
    event.data.offer.itemsToGive.forEach((item) => {
      this.addAssetIds(lostItems, ourSteamID, item.appid, item.contextid, [
        item.assetid,
      ]);
    });

    event.data.offer.itemsToReceive.forEach((item) => {
      this.addAssetIds(lostItems, theirSteamID, item.appid, item.contextid, [
        item.assetid,
      ]);
    });

    return this.updateInventories(
      lostItems,
      {},
      InventoryChangedEventReason.Trade,
    );
  }

  private async handleItemLost(event: TF2LostEvent): Promise<void> {
    const lostItems: Record<string, string[]> = {};

    this.addAssetIds(
      lostItems,
      new SteamID(event.metadata.steamid64 as string),
      440,
      '2',
      [event.data.id],
    );

    return this.updateInventories(
      lostItems,
      {},
      InventoryChangedEventReason.TF2,
    );
  }

  private async handleItemGained(event: TF2GainedEvent): Promise<void> {
    const gainedItems: Record<string, InventoryItem[]> = {};

    this.addItems(
      gainedItems,
      new SteamID(event.metadata.steamid64 as string),
      [
        {
          appid: 440,
          contextid: '2',
          assetid: event.data.id,
        },
      ],
    );

    return this.updateInventories(
      {},
      gainedItems,
      InventoryChangedEventReason.TF2,
    );
  }

  private getInventoryKey(steamid: SteamID, appid: number, contextid: string) {
    return `inventory:${steamid.getSteamID64()}:${appid}:${contextid}`;
  }

  private getInventoryKeyFromObject(data: InventoryIdentifier) {
    const { steamid64, appid, contextid } = data;
    return this.getInventoryKey(new SteamID(steamid64), appid, contextid);
  }

  private getInventoryResource(data: InventoryIdentifier) {
    const { steamid64, appid, contextid } = data;
    return `inventories:${steamid64}:${appid}:${contextid}`;
  }

  private getInventoryJobId(
    steamid: SteamID,
    appid: number,
    contextid: string,
  ) {
    return `${steamid.getSteamID64()}_${appid}_${contextid}`;
  }
}
