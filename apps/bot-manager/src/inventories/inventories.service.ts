import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  BOT_EXCHANGE_NAME,
  INVENTORIES_BASE_URL,
  Inventory,
  INVENTORY_PATH,
  Item,
  TF2LostEvent,
  TF2_LOST_EVENT,
  TradeChangedEvent,
  TRADE_CHANGED_EVENT,
} from '@tf2-automatic/bot-data';
import { Bot, InventoryResponse } from '@tf2-automatic/bot-manager-data';
import { Redis } from 'ioredis';
import { firstValueFrom } from 'rxjs';
import SteamUser from 'steam-user';
import SteamID from 'steamid';
import { HeartbeatsService } from '../heartbeats/heartbeats.service';

const INVENTORY_EXPIRE_TIME = 600;

@Injectable()
export class InventoriesService {
  constructor(
    @InjectRedis()
    private readonly redis: Redis,
    private readonly httpService: HttpService,
    private readonly heartbeatsService: HeartbeatsService
  ) {}

  async getInventoryFromBot(
    bot: Bot,
    steamid: SteamID,
    appid: number,
    contextid: string
  ): Promise<Inventory> {
    const now = Date.now();

    const response = await firstValueFrom(
      this.httpService.get<Inventory>(
        `http://${bot.ip}:${bot.port}${INVENTORIES_BASE_URL}${INVENTORY_PATH}`
          .replace(':steamid', steamid.getSteamID64())
          .replace(':appid', appid.toString())
          .replace(':contextid', contextid)
      )
    );

    const inventory = response.data;

    const object = inventory.reduce((acc, item) => {
      acc[`item:${item.assetid}`] = JSON.stringify(item);
      return acc;
    }, {});

    object['timestamp'] = now;

    const key = this.getInventoryKey(steamid, appid, contextid);

    // Save inventory in Redis
    await this.redis.hset(key, object);

    // Make the inventory expire
    await this.redis.expire(key, INVENTORY_EXPIRE_TIME);

    return inventory;
  }

  async deleteInventory(
    steamid: SteamID,
    appid: number,
    contextid: string
  ): Promise<void> {
    const key = this.getInventoryKey(steamid, appid, contextid);
    await this.redis.del(key);
  }

  async getInventory(
    steamid: SteamID,
    appid: number,
    contextid: string
  ): Promise<InventoryResponse> {
    // Check if inventory is in the cache
    const cached = await this.getInventoryFromCache(steamid, appid, contextid);
    if (cached !== null) {
      return {
        cached: true,
        timestamp: cached.timestamp,
        inventory: cached.inventory,
      };
    }

    // If the client wants non-cached data then fetch it, store it, and return it
    const bots = await this.heartbeatsService.getBots();
    if (bots.length === 0) {
      throw new ServiceUnavailableException('No bots available');
    }

    // Choose a random bot
    const bot = bots[Math.floor(Math.random() * bots.length)];

    // Get the inventory of the bot
    return this.getInventoryFromBot(bot, steamid, appid, contextid).then(
      (inventory) => ({
        cached: false,
        timestamp: Math.floor(Date.now() / 1000),
        inventory,
      })
    );
  }

  async getInventoryFromCache(
    steamid: SteamID,
    appid: number,
    contextid: string
  ): Promise<{
    timestamp: number;
    inventory: Inventory;
  } | null> {
    const key = this.getInventoryKey(steamid, appid, contextid);

    // Check if inventory is in redis
    const exists = await this.redis.exists(key);
    if (!exists) {
      return null;
    }

    const rawTimestamp = await this.redis.hget(key, 'timestamp');

    const timestamp = rawTimestamp === null ? null : parseInt(rawTimestamp, 10);

    if (timestamp === null) {
      // If the inventory doesn't have a timestamp then it's invalid
      return this.redis.del(key).then(() => null);
    } else if (Date.now() - timestamp > INVENTORY_EXPIRE_TIME * 1000) {
      // If the inventory is older than expire time seconds then it's invalid
      return this.redis.del(key).then(() => null);
    }

    const object = await this.redis.hgetall(key);

    const inventory = Object.keys(object)
      .filter((key) => {
        return key.startsWith('item:');
      })
      .map((item) => JSON.parse(object[item]));

    return {
      timestamp: Math.floor(timestamp / 1000),
      inventory,
    };
  }

  @RabbitSubscribe({
    exchange: BOT_EXCHANGE_NAME,
    routingKey: [TF2_LOST_EVENT, TRADE_CHANGED_EVENT],
    queue: 'bot-manager.delete-inventory-items',
    allowNonJsonMessages: false,
  })
  private handleDeleteInventoryItems(
    event: TF2LostEvent | TradeChangedEvent
  ): Promise<void> {
    switch (event.type) {
      case TRADE_CHANGED_EVENT:
        return this.handleOfferChanged(event as TradeChangedEvent);
      case TF2_LOST_EVENT:
        return this.handleItemLost(event as TF2LostEvent);
      default:
        return Promise.resolve();
    }
  }

  private async handleOfferChanged(event: TradeChangedEvent): Promise<void> {
    if (event.data.offer.state !== SteamUser.ETradeOfferState.Accepted) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const ourSteamID = new SteamID(event.metadata.steamid64!);
    const theirSteamID = new SteamID(event.data.offer.partner);

    // Create an object of inventory keys which each contains an array of items to delete
    const lostItems: Record<string, string[]> = {};

    const addLostItems = (steamid: SteamID, items: Item[]) => {
      items.reduce((acc, cur) => {
        const items = (acc[
          this.getInventoryKey(steamid, cur.appid, cur.contextid)
        ] = acc[cur.appid] ?? []);

        items.push('item:' + cur.assetid);
        return acc;
      }, lostItems);
    };

    // Add items to the object
    addLostItems(ourSteamID, event.data.offer.itemsToGive);
    addLostItems(theirSteamID, event.data.offer.itemsToReceive);

    // Delete the items
    await Promise.all(
      Object.keys(lostItems).map((key) =>
        this.redis.hdel(key, ...lostItems[key])
      )
    );
  }

  private async handleItemLost(event: TF2LostEvent): Promise<void> {
    const key = this.getInventoryKey(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      new SteamID(event.metadata.steamid64!),
      440,
      '2'
    );

    // Delete item from cached inventory
    await this.redis.hdel(key, 'item:' + event.data.id);
  }

  private getInventoryKey(steamid: SteamID, appid: number, contextid: string) {
    return `inventory:${steamid.getSteamID64()}:${appid}:${contextid}`;
  }
}
