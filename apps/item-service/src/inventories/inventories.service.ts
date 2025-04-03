import {
  Injectable,
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
  InventoryChangedEvent,
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
import { InjectRedis } from '@songkeys/nestjs-redis';
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
import { InventoryJobData } from './inventories.types';
import { ClsService } from 'nestjs-cls';
import { getUserAgent } from '@tf2-automatic/config';
import { Job } from '@tf2-automatic/common-data';

export const INVENTORY_EXPIRE_TIME = 600;

const DEFAULT_EXTRA_KEYS: (keyof Item)[] = [
  'parts',
  'spells',
  'inputs',
  'quantity',
];

const DEFAULT_ITEM = SKU.getDefault();

const USER_AGENT = getUserAgent(false)!;

@Injectable()
export class InventoriesService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly queueManager: QueueManagerWithEvents<
    InventoryJobOptions,
    InventoryJobData
  >;

  constructor(
    private readonly eventsService: NestEventsService,
    private readonly botsService: BotsService,
    private readonly schemaService: SchemaService,
    private readonly managerService: ManagerService,
    @InjectRedis() private readonly redis: Redis,
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
    await this.eventsService.subscribe<InventoryChangedEvent>(
      'item-service.inventory-changed',
      BOT_MANAGER_EXCHANGE_NAME,
      [INVENTORY_CHANGED_EVENT],
      async (event) => {
        console.log(event);
      },
      {
        retry: true,
      },
    );

    await this.eventsService.subscribe(
      'item-service.loaded-inventory',
      BOT_MANAGER_EXCHANGE_NAME,
      [INVENTORY_LOADED_EVENT],
      async (event) => {
        if (
          event.metadata.userAgent &&
          event.metadata.userAgent.startsWith(USER_AGENT)
        ) {
          // The event originated from this service and should be ignored to
          // prevent duplicate processing of inventories.
          return;
        }

        console.log(event);
      },
      {
        retry: true,
      },
    );

    await this.eventsService.subscribe<TF2GainedEvent>(
      'item-service.save-tf2-items',
      BOT_EXCHANGE_NAME,
      [TF2_GAINED_EVENT],
      async (event) => {
        console.log(event);
        /* const [extracted, context] = this.tf2Parser.extract(event.data);
        const parsed = await this.tf2Parser.parse(extracted, context); */
      },
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

  async addJob(
    steamid: SteamID,
    dto: EnqueueInventoryDto,
  ): Promise<CustomJob<InventoryJobData>> {
    return this.queueManager.addJob(
      this.getJobId(steamid),
      'load',
      {
        steamid64: steamid.getSteamID64(),
        ttl: dto.ttl,
      },
      {
        retry: dto.retry,
        priority: dto.priority,
        bot: dto.bot,
      },
    );
  }

  async removeJob(steamid: SteamID): Promise<void> {
    await this.queueManager.removeJobById(this.getJobId(steamid));
  }

  async getJobs(page = 1, pageSize = 10) {
    return this.queueManager.getJobs(page, pageSize);
  }

  async getInventoryFromCache(steamid: SteamID): Promise<InventoryResponse> {
    const key = this.getInventoryKey(steamid.getSteamID64());

    const [ttl, object] = await Promise.all([
      this.redis.ttl(key),
      this.redis.hgetallBuffer(key),
    ]);

    if (ttl === -2) {
      // Inventory is not in the cache
      throw new NotFoundException('Inventory not found');
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
              attributes[assetid][key] = value as any;
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

  private async handleBotHeartbeatEvent(event: BotHeartbeatEvent) {
    if (Date.now() > event.data.interval + event.metadata.time * 1000) {
      // Ignore the event if the interval has passed
      return;
    }

    // TODO: Use cache here?
    const parsed = await this.getAndParseInventoryByBot(event.data, true);

    await this.saveInventory(parsed, new SteamID(event.data.steamid64));
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

    return this.parseEconItems(inventory.items);
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

  async fetchInventoryBySteamID(
    steamid: SteamID,
    extract?: (keyof Item)[],
    useCache = true,
    ttl = INVENTORY_EXPIRE_TIME,
  ): Promise<InventoryResponse> {
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

    return this.saveInventory(parsed, steamid, extract, ttl);
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
    items: InventoryItem[],
    steamid: SteamID,
    extract?: (keyof Item)[],
    ttl: number = INVENTORY_EXPIRE_TIME,
  ): Promise<InventoryResponse> {
    const now = Math.floor(Date.now() / 1000);

    const inventory: Record<string, any> = {};

    const assets: Record<string, string[]> = {};
    const attributes: Record<string, Partial<Item>> = {};

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      let hasExtra = false;

      const extra: Record<string, any> = {};

      for (const key of DEFAULT_EXTRA_KEYS) {
        const [exists, value] = this.extractValueAndDeleteKey(item, key);
        if (exists) {
          hasExtra = true;
          extra[key] = value;
        }
      }

      const sku = SKU.fromObject(item);
      inventory['item:' + item.assetid] = sku;

      if (assets[sku] === undefined) {
        assets[sku] = [];
      }
      assets[sku].push(item.assetid);

      if (hasExtra) {
        inventory['attribute:' + item.assetid] = pack(extra);
        attributes[item.assetid] = extra;
      }
    }

    inventory['timestamp'] = now;

    const key = this.getInventoryKey(steamid.getSteamID64());

    const event = {
      steamid64: steamid.getSteamID64(),
      timestamp: now,
      itemCount: items.length,
    } satisfies InventoryLoadedEvent['data'];

    const multi = this.redis.multi().hset(key, inventory);

    this.relayService.publishEvent<InventoryLoadedEvent>(
      multi,
      INVENTORY_LOADED_EVENT,
      event,
      steamid,
    );

    if (ttl > 0) {
      // and make it expire
      multi.expire(key, ttl);
    }

    await multi.exec();

    const response = {
      timestamp: now,
      ttl,
      items: assets,
      attributes,
    };

    this.extractAttributesFromInventory(response, extract);

    return response;
  }

  private async parseTF2Items(items: TF2Item[]): Promise<InventoryItem[]> {
    const parser = this.schemaService.getTF2Parser();

    const parsed: Promise<InventoryItem>[] = new Array(items.length);

    for (let i = 0; i < items.length; i++) {
      const [extracted, context] = parser.extract(items[i]);
      // TODO: Catch parser errors and log the original item
      parsed[i] = parser.parse(extracted, context);
    }

    return Promise.all(parsed);
  }

  private async parseEconItems(items: EconItem[]): Promise<InventoryItem[]> {
    const parser = this.schemaService.getEconParser();

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

  mapJob(job: CustomJob<InventoryJobData>): Job {
    return {
      id: job.id as string,
      type: job.data.type,
      priority: job.priority,
      data: job.data.options,
      retry: job.data.retry,
      attempts: job.attemptsMade,
      lastProcessedAt:
        job.processedOn === undefined
          ? null
          : Math.floor(job.processedOn / 1000),
      createdAt: Math.floor(job.timestamp / 1000),
    };
  }
}
