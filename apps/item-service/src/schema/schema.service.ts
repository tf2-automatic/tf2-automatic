import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRedis } from '@songkeys/nestjs-redis';
import {
  BOT_EXCHANGE_NAME,
  TF2_SCHEMA_EVENT,
  TF2SchemaEvent,
} from '@tf2-automatic/bot-data';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Config, SchemaConfig } from '../common/config/configuration';
import { ConfigService } from '@nestjs/config';
import {
  JobData,
  GetSchemaItemsResponse,
  GetSchemaOverviewResponse,
  JobWithTypes as Job,
} from './schema.types';
import { unpack, pack } from 'msgpackr';
import {
  PaintKit,
  Quality,
  SchemaItem,
} from '@tf2-automatic/item-service-data';
import { parse as vdf } from 'kvparser';

// Keeps track of the current version of the schema
const ITEMS_GAME_URL_KEY = 'schema:items-game-url';
// The last time the schema was updated
const LAST_UPDATED_KEY = 'schema:last-updated';
// All schema items are stored in a hash set with the defindex as the key
const SCHEMA_ITEMS_KEY = 'schema:items';
// All schema items are stored in a set with the name as the key and the defindex as the value(s)
const SCHEMA_ITEMS_NAME_KEY = 'schema:items:name:<name>';
// A key that stores the suffix of the current schema keys
const CURRENT_SCHEMA_KEY = 'schema:current';
// A hash set that stores all schema qualities with the id as the key
const SCHEMA_QUALITIES_ID_KEY = 'schema:qualities:id:<id>';
// A hash set that stores all schema qualities with the name as the key
const SCHEMA_QUALITIES_NAME_KEY = 'schema:qualities:name:<name>';
// A hash set that stores all schema effects with the id as the key
const SCHEMA_EFFECTS_ID_KEY = 'schema:effects:id:<id>';
// A hash set that stores all schema effects with the name as the key
const SCHEMA_EFFECTS_NAME_KEY = 'schema:effects:name:<name>';
// A hash set that stores all paintkits with the id as the key
const PAINTKIT_ID_KEY = 'schema:paintkit:id:<id>';
// A hash set that stores all paintkits with the name as the key
const PAINTKIT_NAME_KEY = 'schema:paintkit:name:<name>';

@Injectable()
export class SchemaService implements OnApplicationBootstrap {
  private readonly updateTimeout =
    this.configService.getOrThrow<SchemaConfig>('schema').updateTimeout;

  constructor(
    @InjectQueue('schema')
    private readonly queue: Queue<JobData>,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventsService: NestEventsService,
    private readonly configService: ConfigService<Config>,
  ) {}

  async onApplicationBootstrap() {
    await this.eventsService.subscribe(
      'item-service.schema-updated',
      BOT_EXCHANGE_NAME,
      [TF2_SCHEMA_EVENT],
      async (event: TF2SchemaEvent) => {
        const url = event.data.itemsGameUrl;
        return this.createJobsIfNotRecentlyUpdated(url).then(() => undefined);
      },
      {
        retry: true,
      },
    );
  }

  async getItemByDefindex(defindex: string): Promise<any> {
    const items = await this.getItemsByDefindexes([defindex]);

    const match = items[defindex];
    if (!match) {
      throw new NotFoundException('Item not found');
    }

    return match;
  }

  async getItemsByName(name: string): Promise<SchemaItem[]> {
    const currentKey = await this.getCurrentKeyAndError();

    const defindexes = await this.redis.smembers(
      this.getSuffixedKey(SCHEMA_ITEMS_NAME_KEY, currentKey, {
        name: Buffer.from(name).toString('base64'),
      }),
    );

    if (!defindexes.length) {
      throw new NotFoundException('Item not found');
    }

    return Object.values(await this.getItemsByDefindexes(defindexes));
  }

  private async getItemsByDefindexes(
    defindexes: string[],
  ): Promise<Record<string, SchemaItem>> {
    const match = await this.redis.hmgetBuffer(SCHEMA_ITEMS_KEY, ...defindexes);

    const items: Record<string, SchemaItem> = {};

    for (let i = 0; i < defindexes.length; i++) {
      const value = match[i];
      if (value !== null) {
        items[defindexes[i]] = unpack(value);
      }
    }

    return items;
  }

  async getQualitiesById(id: string): Promise<Quality> {
    const quality = await this.redis.hgetBuffer(SCHEMA_QUALITIES_ID_KEY, id);

    if (!quality) {
      throw new NotFoundException('Quality not found');
    }

    return unpack(quality);
  }

  async getQualitiesByName(name: string): Promise<Quality> {
    const quality = await this.redis.hgetBuffer(
      SCHEMA_QUALITIES_NAME_KEY,
      Buffer.from(name).toString('base64'),
    );

    if (!quality) {
      throw new NotFoundException('Quality not found');
    }

    return unpack(quality);
  }

  async getEffectsById(id: string): Promise<any> {
    const effect = await this.redis.hgetBuffer(SCHEMA_EFFECTS_ID_KEY, id);

    if (!effect) {
      throw new NotFoundException('Effect not found');
    }

    return unpack(effect);
  }

  async getEffectsByName(name: string): Promise<any> {
    const effect = await this.redis.hgetBuffer(
      SCHEMA_EFFECTS_NAME_KEY,
      Buffer.from(name).toString('base64'),
    );

    if (!effect) {
      throw new NotFoundException('Effect not found');
    }

    return unpack(effect);
  }

  async getPaintKitById(id: string): Promise<PaintKit> {
    const paintkit = await this.redis.hgetBuffer(PAINTKIT_ID_KEY, id);

    if (!paintkit) {
      throw new NotFoundException('Paintkit not found');
    }

    return unpack(paintkit);
  }

  async getPaintKitByName(name: string): Promise<PaintKit> {
    const paintkit = await this.redis.hgetBuffer(
      PAINTKIT_NAME_KEY,
      Buffer.from(name).toString('base64'),
    );

    if (!paintkit) {
      throw new NotFoundException('Paintkit not found');
    }

    return unpack(paintkit);
  }

  private async getCurrentKey(): Promise<string | null> {
    return this.redis.get(CURRENT_SCHEMA_KEY);
  }

  private async getCurrentKeyAndError() {
    const current = await this.getCurrentKey();
    if (!current) {
      throw new NotFoundException('Schema not found');
    }

    return current;
  }

  async createJobsIfNotRecentlyUpdated(url?: string): Promise<boolean> {
    // Check if the url is the same as the current one
    if (url && (await this.isSameItemsGameUrl(url))) {
      return false;
    }

    // Check if we are already updating the schema or if it was recently updated
    const lastUpdated = await this.redis.get(LAST_UPDATED_KEY);
    if (lastUpdated && Date.now() - Number(lastUpdated) < this.updateTimeout) {
      return false;
    }

    await this.createSchemaJob().then(() => this.setLastUpdated());

    await this.setLastUpdated();

    return true;
  }

  private setLastUpdated() {
    return this.redis.set(
      LAST_UPDATED_KEY,
      Date.now(),
      'EX',
      Math.floor(this.updateTimeout / 1000),
    );
  }

  private getItemsGameUrl(): Promise<string | null> {
    return this.redis.get(ITEMS_GAME_URL_KEY);
  }

  private setItemsGameUrl(url: string) {
    return this.redis.set(ITEMS_GAME_URL_KEY, url);
  }

  private async isSameItemsGameUrl(url: string): Promise<boolean> {
    const currentItemsGameUrl = await this.getItemsGameUrl();
    return currentItemsGameUrl === url;
  }

  private async isOlderThanCurrentSchema(time: number): Promise<boolean> {
    const currentKey = await this.getCurrentKey();
    if (!currentKey) {
      return false;
    }

    return Number(currentKey) > time;
  }

  private createSchemaJob() {
    return this.queue.add('schema', {
      time: Date.now(),
    });
  }

  private createItemsJob(time: number, start: number) {
    return this.queue.add('items', {
      time,
      start,
    });
  }

  private createItemJobs(time: number) {
    return this.queue.addBulk([
      {
        name: 'proto_obj_defs',
        data: {
          time,
        },
      },
      {
        name: 'items',
        data: {
          time,
          start: 0,
        },
      },
    ]);
  }

  async updateOverview(job: Job, result: GetSchemaOverviewResponse) {
    // Check if the items game url is the same as the current one
    if (await this.isSameItemsGameUrl(result.items_game_url)) {
      return;
    } else if (await this.isOlderThanCurrentSchema(job.data.time)) {
      return;
    }

    // Store schema stuff
    const qualitiesByName: Record<string, Buffer> = {};
    const qualitiesById: Record<string, Buffer> = {};

    for (const internalName in result.qualityNames) {
      const name = result.qualityNames[internalName];
      const id = result.qualities[internalName];

      const quality: Quality = {
        id,
        name,
      };

      const packed = pack(quality);

      qualitiesByName[Buffer.from(name).toString('base64')] = packed;
      qualitiesById[id.toString()] = packed;
    }

    const effectsByName: Record<string, Buffer> = {};
    const effectsById: Record<string, Buffer> = {};

    for (const effect of result.attribute_controlled_attached_particles) {
      const packed = pack(effect);

      effectsByName[Buffer.from(effect.name).toString('base64')] = packed;
      effectsById[effect.id.toString()] = packed;
    }

    await this.redis
      .multi()
      .hmset(SCHEMA_QUALITIES_NAME_KEY, qualitiesByName)
      .hmset(SCHEMA_QUALITIES_ID_KEY, qualitiesById)
      .hmset(SCHEMA_EFFECTS_NAME_KEY, effectsByName)
      .hmset(SCHEMA_EFFECTS_ID_KEY, effectsById)
      .exec();

    await this.createItemJobs(job.data.time);

    await Promise.all([
      this.setLastUpdated(),
      this.setItemsGameUrl(result.items_game_url),
    ]);
  }

  async updateItems(job: Job, result: GetSchemaItemsResponse) {
    // Check if the current schema key is newer than the job time
    if (await this.isOlderThanCurrentSchema(job.data.time)) {
      return;
    }

    if (!(await this.isSameItemsGameUrl(result.items_game_url))) {
      // The items game url has changed while we were updating the items
      return this.createSchemaJob();
    } else if (result.next) {
      // There are more items to fetch
      await this.createItemsJob(job.data.time, result.next);
    }

    const defindexToItem: Record<string, Buffer> = {};

    for (const item of result.items) {
      const serialized = pack(item);
      const defindex = item.defindex.toString();

      // Save the item to the defindex key
      defindexToItem[defindex] = serialized;

      // Save the item to the name key
      await this.redis.sadd(
        this.getSuffixedKey(SCHEMA_ITEMS_NAME_KEY, job.data.time, {
          name: Buffer.from(item.item_name).toString('base64'),
        }),
        defindex,
      );
    }

    const tempSchemaItemsKey = this.getSuffixedKey(
      SCHEMA_ITEMS_KEY,
      job.data.time,
    );

    // Save the schema items to a temporary key
    await this.redis.multi().hmset(tempSchemaItemsKey, defindexToItem).exec();

    if (result.next) {
      return;
    }

    await this.redis
      .multi()
      // Save the current schema key for future reference
      .set(CURRENT_SCHEMA_KEY, job.data.time)
      // Move the temporary schema items to the main key
      .rename(tempSchemaItemsKey, SCHEMA_ITEMS_KEY)
      .exec();

    // Delete old schema items
    await this.deleteKeysByPattern(
      this.getKey(SCHEMA_ITEMS_NAME_KEY, { name: '*' }),
      job.data.time.toString(),
    );
  }

  async updateProtoObjDefs(job: Job, result: string) {
    const parsed = vdf(result);

    const protodefs = parsed.lang.Tokens;

    const paintkitsById: Record<string, Buffer> = {};
    const paintkitsByName: Record<string, Buffer> = {};

    for (const protodef in protodefs) {
      const parts = protodef.slice(0, protodef.indexOf(' ')).split('_');
      if (parts.length !== 3) {
        continue;
      }

      const type = parts[0];
      if (type !== '9') {
        continue;
      }

      const id = parseInt(parts[1]);
      if (isNaN(id)) {
        continue;
      }

      const name = protodefs[protodef];
      if (name.startsWith(id + ': (Unused)')) {
        continue;
      }

      const packed = pack({ id, name });

      paintkitsById[id.toString()] = packed;
      paintkitsByName[Buffer.from(name).toString('base64')] = packed;
    }

    await this.redis
      .multi()
      .del(PAINTKIT_ID_KEY)
      .hmset(PAINTKIT_ID_KEY, paintkitsById)
      .del(PAINTKIT_NAME_KEY)
      .hmset(PAINTKIT_NAME_KEY, paintkitsByName)
      .exec();
  }

  private deleteKeysByPattern(pattern: string, excludeSuffix?: string) {
    const prefix = this.redis.options.keyPrefix ?? '';

    return new Promise((resolve, reject) => {
      const stream = this.redis.scanStream({
        match: prefix + pattern,
        count: 100,
      });

      stream.on('data', (keys: string[]) => {
        if (keys.length === 0) {
          return;
        }

        let keysToDelete = keys.map((k) => k.substring(prefix.length));
        if (excludeSuffix) {
          keysToDelete = keysToDelete.filter((k) => !k.endsWith(excludeSuffix));
        }

        if (keysToDelete.length === 0) {
          return;
        }

        stream.pause();

        this.redis
          .del(keysToDelete)
          .then(() => stream.resume())
          .catch((err) => {
            stream.destroy(err);
          });
      });

      stream.on('end', resolve);
      stream.on('error', reject);
    });
  }

  private getKey(key: string, properties?: Record<string, any>) {
    if (properties) {
      for (const property in properties) {
        key = key.replace('<' + property + '>', properties[property]);
      }
    }

    return key;
  }

  private getSuffixedKey(
    key: string,
    suffix: any,
    properties?: Record<string, any>,
  ) {
    return this.getKey(key + ':' + suffix, properties);
  }
}
