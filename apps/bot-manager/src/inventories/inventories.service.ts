import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { InjectRedis } from '@songkeys/nestjs-redis';
import { HttpService } from '@nestjs/axios';
import { Injectable, NotFoundException } from '@nestjs/common';
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
import { EventsService } from '../events/events.service';
import { EnqueueInventoryDto } from '@tf2-automatic/dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InventoryQueue } from './interfaces/queue.interfaces';
import { OUTBOX_KEY, OutboxMessage } from '@tf2-automatic/transactional-outbox';
import Redlock from 'redlock';

const INVENTORY_EXPIRE_TIME = 600;

const KEY_PREFIX = 'bot-manager:data:';

@Injectable()
export class InventoriesService {
  private readonly redlock: Redlock;

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
    private readonly httpService: HttpService,
    private readonly eventsService: EventsService,
    @InjectQueue('inventories')
    private readonly inventoriesQueue: Queue<InventoryQueue>,
  ) {
    this.redlock = new Redlock([this.redis]);
  }

  async addToQueue(
    steamid: SteamID,
    appid: number,
    contextid: string,
    dto: EnqueueInventoryDto,
  ): Promise<void> {
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
      tradableOnly: dto.tradableOnly,
    };

    const id = this.getInventoryJobId(steamid, appid, contextid);

    await this.inventoriesQueue.add(id, data, {
      jobId: id,
    });
  }

  async getInventoryFromBot(
    bot: Bot,
    steamid: SteamID,
    appid: number,
    contextid: string,
    ttl: number = INVENTORY_EXPIRE_TIME,
    tradableOnly = true,
  ): Promise<InventoryResponse> {
    const now = Math.floor(Date.now() / 1000);

    const response = await firstValueFrom(
      this.httpService.get<Inventory>(
        `http://${bot.ip}:${bot.port}${INVENTORIES_BASE_URL}${INVENTORY_PATH}`
          .replace(':steamid', steamid.getSteamID64())
          .replace(':appid', appid.toString())
          .replace(':contextid', contextid),
        { params: { tradableOnly: tradableOnly } },
      ),
    );

    const inventory = response.data;

    const object = inventory.reduce((acc, item) => {
      acc[`item:${item.assetid}`] = JSON.stringify(item);
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
      itemCount: inventory.length,
    } satisfies InventoryLoadedEvent['data'];

    // Save inventory in Redis and event in outbox
    await this.redlock.using(
      [
        this.getInventoryResource({
          steamid64: steamid.getSteamID64(),
          appid,
          contextid,
        }),
      ],
      1000,
      async () => {
        await this.redis.hset(tempKey, object);

        const pipeline = this.redis
          .multi()
          .rename(tempKey, key)
          .lpush(
            OUTBOX_KEY,
            JSON.stringify({
              type: INVENTORY_LOADED_EVENT,
              data: event,
              metadata: {
                steamid64: null,
                time: Math.floor(Date.now() / 1000),
              },
            } satisfies OutboxMessage),
          )
          .publish(OUTBOX_KEY, '');

        if (ttl > 0) {
          // and make it expire
          pipeline.expire(key, ttl);
        }

        await pipeline.exec();
      },
    );

    return {
      timestamp: now,
      inventory,
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

    return this.redlock.using(
      [
        this.getInventoryResource({
          steamid64: steamid.getSteamID64(),
          appid,
          contextid,
        }),
      ],
      1000,
      async () => {
        await this.redis.del(this.getInventoryKey(steamid, appid, contextid));
      },
    );
  }

  async getInventoryFromCache(
    steamid: SteamID,
    appid: number,
    contextid: string,
  ): Promise<InventoryResponse> {
    const key = this.getInventoryKey(steamid, appid, contextid);

    return this.redlock.using(
      [
        this.getInventoryResource({
          steamid64: steamid.getSteamID64(),
          appid,
          contextid,
        }),
      ],
      1000,
      async (signal) => {
        const timestamp = await this.redis.hget(key, 'timestamp');
        if (timestamp === null) {
          // Inventory is not in the cache
          throw new NotFoundException('Inventory not found');
        }

        if (signal.aborted) {
          throw signal.error;
        }

        const object = await this.redis.hgetall(key);

        const inventory = Object.keys(object)
          .filter((key) => {
            return key.startsWith('item:');
          })
          .map((item) => JSON.parse(object[item]));

        return {
          timestamp: parseInt(timestamp, 10),
          inventory,
        };
      },
    );
  }

  @RabbitSubscribe({
    exchange: BOT_EXCHANGE_NAME,
    routingKey: [TF2_LOST_EVENT, TRADE_CHANGED_EVENT],
    queue: 'bot-manager.delete-inventory-items',
    allowNonJsonMessages: false,
  })
  private handleDeleteInventoryItems(
    event: TF2LostEvent | TradeChangedEvent,
  ): Promise<void> {
    switch (event.type) {
      case TRADE_CHANGED_EVENT:
        return this.handleOfferChanged(event as TradeChangedEvent);
      case TF2_LOST_EVENT:
        return this.handleItemLost(event as TF2LostEvent);
      default:
        // @ts-expect-error Gives compile-time error if all cases are not handled.
        throw new Error('Unknown type: ' + event.type);
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
      const key = JSON.stringify({
        steamid64: steamid.getSteamID64(),
        appid: appid,
        contextid: contextid,
      });

      result[key] = result[key] ?? [];
      result[key].push(assetid);
    });
  }

  private addItems(
    result: Record<string, Item[]>,
    steamid: SteamID,
    items: ExchangeDetailsItem[],
  ) {
    items.reduce((acc, cur) => {
      const key = JSON.stringify({
        steamid64: steamid.getSteamID64(),
        appid: cur.appid,
        contextid: cur.contextid,
      });

      acc[key] = acc[key] ?? [];
      acc[key].push(cur);
      return acc;
    }, result);
  }

  @RabbitSubscribe({
    exchange: BOT_MANAGER_EXCHANGE_NAME,
    routingKey: EXCHANGE_DETAILS_EVENT,
    queue: 'bot-manager.update-inventory-items',
    allowNonJsonMessages: false,
  })
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
      const parts = JSON.parse(inventory);
      return this.getInventoryResource(parts);
    });

    return this.redlock.using(resources, 5000, async (signal) => {
      // Check if cached inventories exist for the given items
      const inventoriesExists = await Promise.all(
        Object.keys(gainedItems).map((key) =>
          this.redis.exists(this.getInventoryKeyFromObject(JSON.parse(key))),
        ),
      );

      if (signal.aborted) {
        throw signal.error;
      }

      const transaction = this.redis.multi();

      // Add gained items to the cached inventories
      Object.keys(gainedItems)
        // Only add items to inventories that are already cached
        .filter((_, i) => inventoriesExists[i])
        .forEach((inventory) => {
          const items = gainedItems[inventory];

          const key = this.getInventoryKeyFromObject(JSON.parse(inventory));

          // Add the items to the cached inventories
          transaction.hmset(
            key,
            ...items
              .map((item) => ['item:' + item.assetid, JSON.stringify(item)])
              .flat(),
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
          const parts = JSON.parse(key);

          return (
            this.redis
              // Get the items from the cached inventories
              .hmget(
                this.getInventoryKeyFromObject(parts),
                ...lostItems[key].map((assetid) => 'item:' + assetid),
              )
              .then((raw) => {
                // Filter out null values and parse the items
                const items = raw
                  .filter((item): item is string => {
                    return typeof item === 'string';
                  })
                  .map((item) => JSON.parse(item));

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
        transaction.hdel(
          this.getInventoryKeyFromObject(JSON.parse(key)),
          ...lostItems[key].map((assetid) => 'item:' + assetid),
        ),
      );

      let changed = false;

      Object.keys(changes).forEach((key) => {
        const parts = JSON.parse(key);
        const change = changes[key];

        if (change.gained.length === 0 && change.lost.length === 0) {
          return;
        }

        changed = true;

        const changedEvent: InventoryChangedEvent['data'] = {
          steamid64: parts.steamid64,
          appid: parts.appid,
          contextid: parts.contextid,
          gained: change.gained,
          lost: change.lost,
          reason,
        };

        transaction.lpush(
          OUTBOX_KEY,
          JSON.stringify({
            type: INVENTORY_CHANGED_EVENT,
            data: changedEvent,
            metadata: {
              steamid64: null,
              time: Math.floor(Date.now() / 1000),
            },
          } satisfies OutboxMessage),
        );
      });

      if (changed) {
        transaction.publish(OUTBOX_KEY, '');
      }

      await transaction.exec();
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

  private getInventoryKey(steamid: SteamID, appid: number, contextid: string) {
    return `${KEY_PREFIX}inventory:${steamid.getSteamID64()}:${appid}:${contextid}`;
  }

  private getInventoryKeyFromObject(data: {
    steamid64: string;
    appid: number;
    contextid: string;
  }) {
    const { steamid64, appid, contextid } = data;
    return this.getInventoryKey(new SteamID(steamid64), appid, contextid);
  }

  private getInventoryResource(data: {
    steamid64: string;
    appid: number;
    contextid: string;
  }) {
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
