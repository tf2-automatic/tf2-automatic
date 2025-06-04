import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  Bot,
  BOT_HEARTBEAT_EVENT,
  BOT_MANAGER_EXCHANGE_NAME,
  BotHeartbeatEvent,
  INVENTORY_CHANGED_EVENT,
  INVENTORY_LOADED_EVENT,
  InventoryChangedEvent as ManagerInventoryChangedEvent,
  InventoryLoadedEvent as ManagerInventoryLoadedEvent,
} from '@tf2-automatic/bot-manager-data';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import { BotsService } from '../bots/bots.service';
import { SchemaService } from '../schema/schema.service';
import { InventoryItem, Item, SKU } from '@tf2-automatic/tf2-format';
import {
  BOT_EXCHANGE_NAME,
  TF2_GAINED_EVENT,
  TF2GainedEvent,
  TF2Item,
} from '@tf2-automatic/bot-data';
import Redis from 'ioredis';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { pack, unpack } from 'msgpackr';
import SteamID from 'steamid';
import {
  InventoryJobOptions,
  InventoryLoadedEvent,
  InventoryResponse,
} from '@tf2-automatic/item-service-data';
import { ManagerService } from '../manager/manager.service';
import { Item as EconItem } from '@tf2-automatic/bot-data';
import { AxiosError } from 'axios';
import { RelayService } from '@tf2-automatic/nestjs-relay';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import assert from 'assert';
import { EnqueueInventoryDto } from '@tf2-automatic/dto';
import { CustomJob, QueueManagerWithEvents } from '@tf2-automatic/queue';
import {
  InventoryData,
  InventoryJobData,
  InventoryResult,
} from './inventories.types';
import { ClsService } from 'nestjs-cls';
import { getUserAgentOrThrow } from '@tf2-automatic/config';

export const INVENTORY_EXPIRE_TIME = 600;

const DEFAULT_EXTRA_KEYS: (keyof Item)[] = [
  'parts',
  'spells',
  'inputs',
  'quantity',
];

const DEFAULT_ITEM = SKU.getDefault();

const USER_AGENT = getUserAgentOrThrow(false);

@Injectable()
export class InventoriesService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(InventoriesService.name);

  private readonly queueManager: QueueManagerWithEvents<
    InventoryJobOptions,
    InventoryJobData
  >;

  private readonly redis: Redis = this.redisService.getOrThrow();

  constructor(
    private readonly eventsService: NestEventsService,
    private readonly botsService: BotsService,
    private readonly schemaService: SchemaService,
    private readonly managerService: ManagerService,
    private readonly redisService: RedisService,
    private readonly relayService: RelayService,
    @InjectQueue('inventories')
    queue: Queue,
    cls: ClsService,
  ) {
    this.queueManager = new QueueManagerWithEvents(queue, cls);
  }

  onModuleDestroy() {
    return this.queueManager.close();
  }

  private getJobId(steamid: SteamID) {
    return `${steamid.getSteamID64()}_440_2`;
  }

  async onApplicationBootstrap() {
    await this.eventsService.subscribe<ManagerInventoryChangedEvent>(
      'item-service.inventory-changed',
      BOT_MANAGER_EXCHANGE_NAME,
      [INVENTORY_CHANGED_EVENT],
      async (event) => this.handleInventoryLoadedEvent(event),
      {
        retry: true,
      },
    );

    await this.eventsService.subscribe<ManagerInventoryLoadedEvent>(
      'item-service.loaded-inventory',
      BOT_MANAGER_EXCHANGE_NAME,
      [INVENTORY_LOADED_EVENT],
      async (event) => this.handleInventoryLoadedEvent(event),
      {
        retry: true,
      },
    );

    await this.eventsService.subscribe<TF2GainedEvent>(
      'item-service.save-tf2-items',
      BOT_EXCHANGE_NAME,
      [TF2_GAINED_EVENT],
      async (event) => this.handleTF2GainedEvent(event),
      {
        retry: true,
      },
    );

    await this.eventsService.subscribe<BotHeartbeatEvent>(
      'item-service.load-inventory',
      BOT_MANAGER_EXCHANGE_NAME,
      [BOT_HEARTBEAT_EVENT],
      (event) => this.handleBotHeartbeatEvent(event),
      {
        retry: true,
      },
    );
  }

  private async handleBotHeartbeatEvent(event: BotHeartbeatEvent) {
    if (Date.now() > event.data.interval + event.metadata.time * 1000) {
      // Ignore the event if the interval has passed
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    // We use the cache to avoid spamming steam with requests to load the inventory.
    // It prioritizes loading the inventory using /tf2/backpack anyway, and if it is
    // cached then the bot-manager does a good job at keeping it up to date.
    const parsed = await this.getAndParseInventoryByBot(event.data, true);

    await this.saveInventory(new SteamID(event.data.steamid64), {
      result: parsed,
      error: null,
      timestamp: now,
    });
  }

  private async handleInventoryLoadedEvent(
    event: ManagerInventoryLoadedEvent | ManagerInventoryChangedEvent,
  ) {
    if (event.data.appid !== 440 || event.data.contextid !== '2') {
      // Ignore non-TF2 inventories
      return;
    } else if (
      event.metadata.userAgent &&
      event.metadata.userAgent.startsWith(USER_AGENT)
    ) {
      // The event originated from this service and should be ignored to
      // prevent duplicate processing of inventories.
      return;
    }

    const steamid = new SteamID(event.metadata.steamid64);

    const timestamp = await this.getLastUpdated(steamid);
    if (timestamp && timestamp > event.metadata.time) {
      // Ignore the event if the timestamp is older than the cache
      return;
    }

    const parsed = await this.getAndParseEconInventory(steamid, true);

    await this.saveInventory(steamid, {
      result: parsed,
      error: null,
      timestamp: event.metadata.time,
    });
  }

  private async handleTF2GainedEvent(event: TF2GainedEvent) {
    const steamid = new SteamID(event.metadata.steamid64);
    const lastUpdated = await this.getLastUpdated(steamid);
    if (lastUpdated && lastUpdated > event.metadata.time) {
      return;
    }

    await this.addJob(steamid);
  }

  async addJob(
    steamid: SteamID,
    dto?: EnqueueInventoryDto,
  ): Promise<CustomJob<InventoryJobData>> {
    return this.queueManager.addJob(
      this.getJobId(steamid),
      'load',
      {
        steamid64: steamid.getSteamID64(),
        ttl: dto?.ttl,
      },
      {
        retry: dto?.retry,
        priority: dto?.priority,
        bot: dto?.bot,
      },
    );
  }

  async removeJob(steamid: SteamID): Promise<void> {
    await this.queueManager.removeJobById(this.getJobId(steamid));
  }

  private async getLastUpdated(steamid: SteamID): Promise<number | null> {
    const key = this.getInventoryKey(steamid.getSteamID64());
    const timestamp = await this.redis.hget(key, 'timestamp');
    if (!timestamp) {
      return null;
    }
    return parseInt(timestamp.toString());
  }

  async getSkuByAsset(
    steamid: SteamID,
    assetid: string,
    extract?: (keyof Item)[],
  ): Promise<string> {
    const inventory = await this.getInventoryFromCacheAndExtractAttributes(
      steamid,
      extract,
    );

    for (const sku in inventory.items) {
      const assetids = inventory.items[sku];
      if (assetids.includes(assetid)) {
        return sku;
      }
    }

    throw new NotFoundException('Asset not found');
  }

  async getInventoryFromCache(steamid: SteamID): Promise<InventoryResponse> {
    const key = this.getInventoryKey(steamid.getSteamID64());

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

    const items: Record<string, string[]> = {};
    const attributes: Record<string, Partial<Item>> = {};
    let timestamp = 0;

    for (const key in object) {
      if (key.startsWith('item:')) {
        const sku = object[key].toString();
        if (items[sku] === undefined) {
          items[sku] = [];
        }
        items[sku].push(key.slice(5));
      } else if (key.startsWith('attribute:')) {
        const assetid = key.slice(10);
        attributes[assetid] = unpack(object[key]);
      } else if (key === 'timestamp') {
        timestamp = parseInt(object[key].toString());
      }
    }

    assert(timestamp !== 0, 'Timestamp is not set');

    return {
      timestamp,
      ttl,
      items,
      attributes,
    };
  }

  async getInventoryFromCacheAndExtractAttributes(
    steamid: SteamID,
    extract?: (keyof Item)[],
  ) {
    const inventory = await this.getInventoryFromCache(steamid);
    return this.extractAttributesFromInventory(inventory, extract);
  }

  private extractAttributesFromInventory(
    inventory: InventoryResponse,
    extract?: (keyof Item)[],
  ): InventoryResponse {
    if (extract && extract.length !== 0) {
      // Change the extras
      const items = inventory.items;
      const attributes = inventory.attributes;

      for (const sku in items) {
        const item = SKU.fromString(sku);

        for (const key of extract) {
          const [exists, value] = this.extractValueAndDeleteKey(item, key);
          if (exists) {
            for (const assetid of items[sku]) {
              attributes[assetid] = attributes[assetid] ?? {};
              (attributes[assetid][key] as unknown) = value;
            }
          }
        }

        const newSku = SKU.fromObject(item);
        if (newSku !== sku) {
          const assetids = (items[newSku] ?? []).concat(items[sku]);
          delete items[sku];
          items[newSku] = assetids;
        }
      }
    }

    return inventory;
  }

  private async getAndParseTF2Inventory(bot: Bot): Promise<InventoryItem[]> {
    const inventory = await this.botsService.getTF2Inventory(bot);
    return this.parseTF2Items(inventory);
  }

  private async getAndParseEconInventory(
    steamid: SteamID,
    useCache: boolean,
  ): Promise<InventoryItem[]> {
    const inventory = await this.managerService.fetchInventoryBySteamID(
      steamid,
      useCache,
    );

    return this.parseEconItems(inventory.items, inventory.timestamp);
  }

  async fetchInventory(
    steamid: SteamID,
    extract?: (keyof Item)[],
    useCache = true,
    ttl = INVENTORY_EXPIRE_TIME,
  ): Promise<InventoryResponse> {
    if (useCache) {
      try {
        const inventory = await this.getInventoryFromCacheAndExtractAttributes(
          steamid,
          extract,
        );
        return inventory;
      } catch (err) {
        if (!(err instanceof NotFoundException)) {
          throw err;
        }
      }
    }

    const job = await this.addJob(steamid, {
      ttl,
    });

    // Wait for it to finish
    await this.queueManager.waitUntilFinished(job, 10000);

    return this.getInventoryFromCacheAndExtractAttributes(steamid, extract);
  }

  async deleteInventory(steamid: SteamID): Promise<void> {
    const key = this.getInventoryKey(steamid.getSteamID64());
    await this.redis.del(key);
  }

  async fetchInventoryBySteamID(
    steamid: SteamID,
    useCache = true,
  ): Promise<InventoryItem[]> {
    // Check if the SteamID is a bot
    const bot = await this.managerService
      .getBotBySteamID(steamid)
      .catch((err) => {
        if (err instanceof AxiosError && err.response?.status === 404) {
          return null;
        }

        throw err;
      });

    let parsed: InventoryItem[];
    if (bot) {
      parsed = await this.getAndParseInventoryByBot(bot, useCache);
    } else {
      parsed = await this.getAndParseEconInventory(steamid, useCache);
    }

    return parsed;
  }

  private async getAndParseInventoryByBot(bot: Bot, useCache: boolean) {
    const steamid = new SteamID(bot.steamid64);

    let parsed: InventoryItem[];

    try {
      parsed = await this.getAndParseTF2Inventory(bot);
    } catch (err) {
      if (!(err instanceof AxiosError)) {
        throw err;
      }

      parsed = await this.getAndParseEconInventory(steamid, useCache);
    }

    return parsed;
  }

  /* private chainableSaveItems(
    steamid64: string,
    items: InventoryItem[],
    chainable?: ChainableCommander,
  ): ChainableCommander {
    if (!chainable) {
      chainable = this.redis.multi();
    }

    return chainable.hmset(
      'inventory:' + steamid64,
      ...items.flatMap((item) => [item.assetid, pack(item)]),
    );
  } */

  async saveInventory(
    steamid: SteamID,
    result: InventoryResult,
  ): Promise<void> {
    const lastUpdated = await this.getLastUpdated(steamid);
    if (lastUpdated && lastUpdated > result.timestamp) {
      // Ignore the result if the timestamp is older than the cache
      this.logger.warn(
        `Ignoring inventory save because the timestamp is older (${lastUpdated} > ${result.timestamp})`,
      );
      return;
    }

    const save: InventoryData = {
      timestamp: result.timestamp,
    };

    if (result.result) {
      for (let i = 0; i < result.result.length; i++) {
        const item = result.result[i];

        let hasExtra = false;

        const extra: Record<string, Item[keyof Item]> = {};

        for (const key of DEFAULT_EXTRA_KEYS) {
          const [exists, value] = this.extractValueAndDeleteKey(item, key);
          if (exists) {
            hasExtra = true;
            extra[key] = value;
          }
        }

        const sku = SKU.fromObject(item);
        save['item:' + item.assetid] = sku;
        if (hasExtra) {
          save['attribute:' + item.assetid] = pack(extra);
        }
      }
    }

    if (result.error) {
      save.error = pack(result.error);
    }

    const key = this.getInventoryKey(steamid.getSteamID64());

    const ttl = result.ttl ?? INVENTORY_EXPIRE_TIME;

    const multi = this.redis.multi().del(key).hset(key, save);
    if (ttl > -1) {
      multi.expire(key, ttl);
    }

    if (result.result) {
      const event = {
        steamid64: steamid.getSteamID64(),
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

    let message = `Saving inventory of ${steamid.getSteamID64()}`;
    if (result.result) {
      message += ` with ${result.result.length} items`;
    }
    if (result.error) {
      message += ` (${result.error.message ?? 'unknown error'})`;
    }

    this.logger.debug(message + '...');

    await multi.exec();
  }

  private async parseTF2Items(
    items: TF2Item[],
    time?: number,
  ): Promise<InventoryItem[]> {
    const parser = this.schemaService.getTF2Parser({ time });

    const parsed: Promise<InventoryItem>[] = new Array(items.length);

    for (let i = 0; i < items.length; i++) {
      const [extracted, context] = parser.extract(items[i]);
      // TODO: Catch parser errors and log the original item
      parsed[i] = parser.parse(extracted, context);
    }

    return Promise.all(parsed);
  }

  private async parseEconItems(
    items: EconItem[],
    time?: number,
  ): Promise<InventoryItem[]> {
    const parser = this.schemaService.getEconParser({ time });

    const parsed: Promise<InventoryItem>[] = new Array(items.length);

    for (let i = 0; i < items.length; i++) {
      const extracted = parser.extract(items[i]);
      // TODO: Catch parser errors and log the original item
      parsed[i] = parser.parse(extracted);
    }

    return Promise.all(parsed);
  }

  private getInventoryKey(steamid64: string) {
    return `inventory:${steamid64}`;
  }

  private extractValueAndDeleteKey(
    item: Item,
    key: keyof Item,
  ): [boolean, Item[keyof Item]] {
    if (!SKU.hasAttribute(item, key)) {
      return [false, null];
    }

    const value = item[key];
    item[key] = DEFAULT_ITEM[key] as never;

    return [true, value];
  }
}
