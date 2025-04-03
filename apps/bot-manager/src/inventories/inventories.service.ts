import { InjectRedis } from '@songkeys/nestjs-redis';
import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
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
} from '@tf2-automatic/bot-manager-data';
import { Redis } from 'ioredis';
import { firstValueFrom } from 'rxjs';
import SteamUser from 'steam-user';
import SteamID from 'steamid';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import { EnqueueInventoryDto } from '@tf2-automatic/dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LockDuration, Locker } from '@tf2-automatic/locking';
import { pack, unpack } from 'msgpackr';
import { RelayService } from '@tf2-automatic/nestjs-relay';
import { ClsService } from 'nestjs-cls';
import { CustomJob, QueueManagerWithEvents } from '@tf2-automatic/queue';
import {
  InventoryData,
  InventoryJobData,
  InventoryResult,
} from './inventories.types';
import assert from 'assert';

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

  private readonly queueManager: QueueManagerWithEvents<
    InventoryJobData['options'],
    InventoryJobData
  >;

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
    private readonly httpService: HttpService,
    private readonly eventsService: NestEventsService,
    @InjectQueue('inventories')
    queue: Queue<CustomJob<InventoryJobData>>,
    private readonly relayService: RelayService,
    cls: ClsService,
  ) {
    this.locker = new Locker(this.redis);

    this.queueManager = new QueueManagerWithEvents(queue, cls);
  }

  async onApplicationBootstrap() {
    // TODO: For some reason we can't do `autorun: false` and then call
    // `this.inventoryQueueEvents.run()`

    await this.eventsService.subscribe(
      'bot-manager.delete-inventory-items',
      BOT_EXCHANGE_NAME,
      [TF2_LOST_EVENT, TRADE_CHANGED_EVENT],
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
    return this.queueManager.close();
  }

  async addJob(
    steamid: SteamID,
    appid: number,
    contextid: string,
    dto: EnqueueInventoryDto,
  ) {
    return this.queueManager.addJob(
      this.getInventoryJobId(steamid, appid, contextid),
      'load',
      {
        steamid64: steamid.getSteamID64(),
        appid,
        contextid,
        ttl: dto.ttl,
      },
      dto,
    );
  }

  async getInventoryFromBot(
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

  async saveInventory(
    steamid: SteamID,
    appid: number,
    contextid: string,
    result: InventoryResult,
  ): Promise<void> {
    const save: InventoryData = {
      timestamp: result.timestamp,
      bot: result.bot,
    };

    if (result.result) {
      for (let i = 0; i < result.result.length; i++) {
        const item = result.result[i];
        save[`item:${item.assetid}`] = pack(item);
      }
    }

    if (result.error) {
      save.error = pack(result.error);
    }

    const key = this.getInventoryKey(steamid.getSteamID64(), appid, contextid);
    const tempKey = key + ':temp';

    // Save inventory in Redis and event in outbox
    await this.locker.using([key], LockDuration.SHORT, async () => {
      const ttl = result.ttl ?? INVENTORY_EXPIRE_TIME;

      const multi = this.redis
        .multi()
        .del(key)
        .hset(key, save)
        .expire(key, ttl);

      if (result.result) {
        const event = {
          steamid64: steamid.getSteamID64(),
          appid,
          contextid,
          timestamp: result.timestamp,
          itemCount: result.result.length,
        } satisfies InventoryLoadedEvent['data'];

        this.relayService.publishEvent<InventoryLoadedEvent>(
          multi,
          INVENTORY_LOADED_EVENT,
          event,
          steamid,
        );
      }

      await multi.exec();
    });
  }

  async deleteInventory(
    steamid: SteamID,
    appid: number,
    contextid: string,
  ): Promise<void> {
    const key = this.getInventoryKey(steamid.getSteamID64(), appid, contextid);

    return this.locker.using([key], LockDuration.SHORT, async () => {
      await this.redis.del(key);
    });
  }

  async removeJob(
    steamid: SteamID,
    appid: number,
    contextid: string,
  ): Promise<void> {
    await this.queueManager.removeJobById(
      this.getInventoryJobId(steamid, appid, contextid),
    );
  }

  async fetchInventory(
    steamid: SteamID,
    appid: number,
    contextid: string,
    useCache = true,
    tradableOnly = true,
    ttl = INVENTORY_EXPIRE_TIME,
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
    const job = await this.addJob(steamid, appid, contextid, {
      ttl,
    });

    // Wait for it to finish
    await this.queueManager.waitUntilFinished(job, 10000);

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
    const key = this.getInventoryKey(steamid.getSteamID64(), appid, contextid);

    const [ttl, object] = await Promise.all([
      this.redis.ttl(key),
      this.redis.hgetallBuffer(key),
    ]);

    if (ttl === -2 || object === null) {
      // Inventory is not in the cache
      throw new NotFoundException('Inventory not found');
    }

    if (object.error) {
      const error = unpack(object.error);
      throw new HttpException(error.message, error.statusCode);
    }

    const items: Item[] = [];
    let timestamp = 0;

    for (const key in object) {
      if (key === 'timestamp') {
        timestamp = parseInt(object[key].toString());
      } else if (key.startsWith('item:')) {
        items.push(unpack(object[key]));
      }
    }

    assert(timestamp !== 0, 'Timestamp is not set');

    return {
      timestamp,
      ttl,
      items,
    };
  }

  private async handleDeleteInventoryItems(
    event: TF2LostEvent | TradeChangedEvent,
  ): Promise<void> {
    switch (event.type) {
      case TRADE_CHANGED_EVENT:
        return this.handleOfferChanged(event);
      case TF2_LOST_EVENT:
        return this.handleItemLost(event);
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
    result: Record<string, Item[]>,
    steamid: SteamID,
    items: Item[],
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
    gainedItems: Record<string, Item[]>,
    reason: InventoryChangedEventReason,
  ) {
    const inventories = Object.keys(lostItems)
      .concat(Object.keys(gainedItems))
      .reduce((acc, item) => {
        acc.add(item);
        return acc;
      }, new Set<string>());

    const resources = Array.from(inventories).map((inventory) => {
      const parts = unpack(
        Buffer.from(inventory, 'base64'),
      ) as InventoryIdentifier;

      return this.getInventoryKey(
        parts.steamid64,
        parts.appid,
        parts.contextid,
      );
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

      const changes: Record<string, { gained: Item[]; lost: Item[] }> = {};

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
        this.relayService.publishEvent<InventoryChangedEvent>(
          multi,
          INVENTORY_CHANGED_EVENT,
          data,
          new SteamID(data.steamid64),
        );
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

  private getInventoryKey(steamid64: string, appid: number, contextid: string) {
    return `inventory:${steamid64}:${appid}:${contextid}`;
  }

  private getInventoryKeyFromObject(data: InventoryIdentifier) {
    const { steamid64, appid, contextid } = data;
    return this.getInventoryKey(steamid64, appid, contextid);
  }

  private getInventoryJobId(
    steamid: SteamID,
    appid: number,
    contextid: string,
  ) {
    return `${steamid.getSteamID64()}_${appid}_${contextid}`;
  }
}
