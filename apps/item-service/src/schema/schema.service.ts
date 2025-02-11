import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRedis } from '@songkeys/nestjs-redis';
import {
  BOT_EXCHANGE_NAME,
  TF2_SCHEMA_EVENT,
  TF2SchemaEvent as BotSchemaEvent,
} from '@tf2-automatic/bot-data';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import { FlowProducer, Queue } from 'bullmq';
import Redis from 'ioredis';
import { Config, SchemaConfig } from '../common/config/configuration';
import { ConfigService } from '@nestjs/config';
import {
  JobData,
  GetSchemaItemsResponse,
  JobWithTypes as Job,
} from './schema.types';
import { unpack, pack } from 'msgpackr';
import {
  AttachedParticle,
  PaintKit,
  Quality,
  Schema,
  SchemaItem,
  SchemaItemsResponse,
  SchemaOverviewResponse,
  Spell,
  SchemaEvent,
  SCHEMA_EVENT,
  SchemaRefreshAction,
} from '@tf2-automatic/item-service-data';
import { parse as vdf } from 'kvparser';
import { NestStorageService } from '@tf2-automatic/nestjs-storage';

// A key that stores the current schema id
const CURRENT_SCHEMA_KEY = 'schema:current';
// A key that stores the
const SCHEMAS_KEY = 'schema:schemas';
// The last time the schema was checked
const LAST_CHECKED_KEY = 'schema:last-checked';
// All schema items are stored in a hash set with the defindex as the key
const SCHEMA_ITEMS_KEY = 'schema:items';
// All schema items are stored in a set with the name as the key and the defindex as the value(s)
const SCHEMA_ITEMS_NAME_KEY = 'schema:items:name';
// A hash set that stores all schema qualities with the id as the key
const SCHEMA_QUALITIES_ID_KEY = 'schema:qualities:id';
// A hash set that stores all schema qualities with the name as the key
const SCHEMA_QUALITIES_NAME_KEY = 'schema:qualities:name';
// A hash set that stores all schema effects with the id as the key
const SCHEMA_EFFECTS_ID_KEY = 'schema:effects:id';
// A hash set that stores all schema effects with the name as the key
const SCHEMA_EFFECTS_NAME_KEY = 'schema:effects:name';
// A hash set that stores all paintkits with the id as the key
const PAINTKIT_ID_KEY = 'schema:paintkit:id';
// A hash set that stores all paintkits with the name as the key
const PAINTKIT_NAME_KEY = 'schema:paintkit:name';
// A hash set that stores all spells with the id as the key
const SPELLS_ID_KEY = 'schema:spells:id';
// A hash set that stores all spells with the name as the key
const SPELLS_NAME_KEY = 'schema:spells:name';

// The name of the schema overview file
const OVERVIEW_FILE = 'schema-overview.json';
// The name of the items game file
const ITEMS_GAME_FILE = 'items_game.txt';

@Injectable()
export class SchemaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaService.name);

  private readonly updateTimeout =
    this.configService.getOrThrow<SchemaConfig>('schema').updateTimeout;

  private readonly producer: FlowProducer = new FlowProducer(this.queue.opts);

  constructor(
    @InjectQueue('schema')
    private readonly queue: Queue<JobData>,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventsService: NestEventsService,
    private readonly configService: ConfigService<Config>,
    private readonly storageService: NestStorageService,
  ) {}

  async onApplicationBootstrap() {
    await this.eventsService.subscribe(
      'item-service.bot-schema',
      BOT_EXCHANGE_NAME,
      [TF2_SCHEMA_EVENT],
      async (event: BotSchemaEvent) => {
        return this.createJobsIfNewUrl(event.data.itemsGameUrl);
      },
      {
        retry: true,
      },
    );
  }

  private async getSchemaOrNull(): Promise<Schema | null> {
    const schemas = await this.getSchemas();
    if (schemas.length === 0) {
      return null;
    }

    return schemas[0];
  }

  async getSchema(): Promise<Schema> {
    const schema = await this.getSchemaOrNull();
    if (schema === null) {
      throw new NotFoundException('Schema not found');
    }

    return schema;
  }

  async getSchemas(): Promise<Schema[]> {
    const raw = await this.redis.hgetallBuffer(SCHEMAS_KEY);

    const schemas: Schema[] = [];

    for (const timestamp in raw) {
      schemas.push(unpack(raw[timestamp]));
    }

    return schemas.sort((a, b) => b.time - a.time);
  }

  async deleteSchema(time: number): Promise<void> {
    const multi = this.redis.multi();

    multi
      .hdel(SCHEMAS_KEY, time.toString())
      .del(this.getKey(PAINTKIT_ID_KEY, time))
      .del(this.getKey(PAINTKIT_NAME_KEY, time))
      .del(this.getKey(SCHEMA_EFFECTS_ID_KEY, time))
      .del(this.getKey(SCHEMA_EFFECTS_NAME_KEY, time))
      .del(this.getKey(SCHEMA_ITEMS_KEY, time))
      .del(this.getKey(SCHEMA_ITEMS_NAME_KEY, time))
      .del(this.getKey(SCHEMA_QUALITIES_ID_KEY, time))
      .del(this.getKey(SCHEMA_QUALITIES_NAME_KEY, time))
      .del(this.getKey(SPELLS_ID_KEY, time))
      .del(this.getKey(SPELLS_NAME_KEY, time));

    await multi.exec();

    await this.storageService.delete(time + '.' + OVERVIEW_FILE);
    await this.storageService.delete(time + '.' + ITEMS_GAME_FILE);
  }

  async getItems(
    cursor: number,
    count: number,
    time?: number,
  ): Promise<SchemaItemsResponse> {
    const schema = await this.getClosestSchemaByTime(time);

    const [newCursor, elements] = await this.redis.hscanBuffer(
      this.getKey(SCHEMA_ITEMS_KEY, schema.time),
      cursor,
      'COUNT',
      count,
    );

    const items: SchemaItem[] = [];

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

  private getHashByBase64(key: string, name: string, time?: number) {
    return this.getHashByName(key, Buffer.from(name).toString('base64'), time);
  }

  private async getHashByName(
    key: string,
    name: string,
    time?: number,
  ): Promise<any> {
    const schema = await this.getClosestSchemaByTime(time);

    const result = await this.redis.hgetBuffer(
      this.getKey(key, schema.time),
      name,
    );

    if (!result) {
      throw new NotFoundException('Not found');
    }

    return unpack(result);
  }

  async getItemByDefindex(defindex: string, time?: number): Promise<any> {
    const items = await this.getItemsByDefindexes([defindex], time);

    const match = items[defindex];
    if (!match) {
      throw new NotFoundException('Item not found');
    }

    return match;
  }

  async getItemsByName(name: string, time?: number): Promise<SchemaItem[]> {
    const defindexes = await this.getHashByBase64(
      SCHEMA_ITEMS_NAME_KEY,
      name,
      time,
    );
    return Object.values(await this.getItemsByDefindexes(defindexes));
  }

  private async getItemsByDefindexes(
    defindexes: string[],
    time?: number,
  ): Promise<Record<string, SchemaItem>> {
    const schema = await this.getClosestSchemaByTime(time);

    const match = await this.redis.hmgetBuffer(
      this.getKey(SCHEMA_ITEMS_KEY, schema.time),
      ...defindexes,
    );

    const items: Record<string, SchemaItem> = {};

    for (let i = 0; i < defindexes.length; i++) {
      const value = match[i];
      if (value !== null) {
        items[defindexes[i]] = unpack(value);
      }
    }

    return items;
  }

  async getQualityById(id: string, time?: number): Promise<Quality> {
    return this.getHashByName(SCHEMA_QUALITIES_ID_KEY, id, time);
  }

  async getQualityByName(name: string, time?: number): Promise<Quality> {
    return this.getHashByBase64(SCHEMA_QUALITIES_NAME_KEY, name, time);
  }

  async getEffectById(id: string, time?: number): Promise<AttachedParticle> {
    return this.getHashByName(SCHEMA_EFFECTS_ID_KEY, id, time);
  }

  async getEffectByName(
    name: string,
    time?: number,
  ): Promise<AttachedParticle> {
    return this.getHashByBase64(SCHEMA_EFFECTS_NAME_KEY, name, time);
  }

  async getPaintKitById(id: string, time?: number): Promise<PaintKit> {
    return this.getHashByName(PAINTKIT_ID_KEY, id, time);
  }

  async getPaintKitByName(name: string, time?: number): Promise<PaintKit> {
    return this.getHashByBase64(PAINTKIT_NAME_KEY, name, time);
  }

  async getSpellById(id: string, time?: number): Promise<Spell> {
    const spellFromAttribute = await this.getSpellByIdFromAttributes(
      id,
      time,
    ).catch((err) => {
      if (err instanceof NotFoundException) {
        return null;
      }

      throw err;
    });

    if (spellFromAttribute) {
      return spellFromAttribute;
    }

    const spellFromItems = await this.getItemByDefindex(id, time).catch(
      (err) => {
        if (
          err instanceof NotFoundException &&
          err.message === 'Spell not found'
        ) {
          return null;
        }

        throw err;
      },
    );

    if (
      spellFromItems &&
      spellFromItems.item_name.startsWith('Halloween Spell: ')
    ) {
      return spellFromItems;
    }

    throw new NotFoundException('Spell not found');
  }

  private async getSpellByIdFromAttributes(
    id: string,
    time?: number,
  ): Promise<Spell> {
    return this.getHashByName(SPELLS_ID_KEY, id, time);
  }

  async getSpellByName(name: string, time?: number): Promise<Spell> {
    const spellFromAttributes = await this.getSpellByNameFromAttributes(
      name,
      time,
    ).catch((err) => {
      if (err instanceof NotFoundException) {
        return null;
      }

      throw err;
    });

    if (spellFromAttributes) {
      return spellFromAttributes;
    }

    const spellFromItems = await this.getItemsByName(
      'Halloween Spell: ' + name,
      time,
    ).catch((err) => {
      if (err instanceof NotFoundException) {
        return [];
      }

      throw err;
    });

    if (spellFromItems.length !== 0) {
      return {
        id: spellFromItems[0].defindex,
        name,
      };
    }

    throw new NotFoundException('Spell not found');
  }

  private async getSpellByNameFromAttributes(
    name: string,
    time?: number,
  ): Promise<Spell> {
    return this.getHashByBase64(SPELLS_NAME_KEY, name, time);
  }

  async createJobsIfNewUrl(url: string): Promise<void> {
    if (await this.isSameItemsGameUrl(url)) {
      return;
    }

    await this.createJobs();
  }

  async createJobs(
    action: SchemaRefreshAction = SchemaRefreshAction.DEFAULT,
  ): Promise<boolean> {
    // Store the time in seconds
    const now = Math.floor(Date.now() / 1000);

    if (action === SchemaRefreshAction.DEFAULT) {
      // Check if the schema was recently queued to be checked
      const last = await this.redis.get(LAST_CHECKED_KEY);
      if (last) {
        // It has been checked earlier
        const time = parseInt(last, 10);
        if (now - time < this.updateTimeout / 1000) {
          return false;
        }

        // Check happened a while ago, we will check again
      }
    }

    await this.redis.set(LAST_CHECKED_KEY, now);

    await this.createSchemaJob(now, action === SchemaRefreshAction.FORCE);

    return true;
  }

  private async isSameItemsGameUrl(url: string): Promise<boolean> {
    const schema = await this.getSchemaOrNull();
    if (!schema) {
      return false;
    }

    return schema.version === url;
  }

  private createSchemaJob(time: number, force = false) {
    return this.queue.add('url', {
      time,
      force,
    });
  }

  private createItemsJob(job: Job, start: number) {
    return this.queue.add(
      'items',
      {
        time: job.data.time,
        start,
      },
      {
        parent: {
          id: job.parent!.id,
          queue: job.queueQualifiedName!,
        },
      },
    );
  }

  private createSchemaJobs(time: number, itemsGameUrl: string) {
    return this.producer.add(
      {
        name: 'schema',
        queueName: 'schema',
        data: {
          time,
          items_game_url: itemsGameUrl,
        },
        children: [
          {
            name: 'overview',
            queueName: 'schema',
            data: {
              time,
            },
          },
          {
            name: 'items_game',
            queueName: 'schema',
            data: {
              time,
              items_game_url: itemsGameUrl,
            },
          },
          {
            name: 'proto_obj_defs',
            queueName: 'schema',
            data: {
              time,
            },
          },
          {
            name: 'items',
            queueName: 'schema',
            data: {
              time,
              start: 0,
            },
          },
        ],
      },
      {
        queuesOptions: {
          [this.queue.name]: {
            defaultJobOptions: this.queue.defaultJobOptions,
          },
        },
      },
    );
  }

  /**
   * This method is called when all schema jobs have finished
   * @param job
   */
  async updateSchema(job: Job, endUrl: string) {
    const current: Schema = {
      version: job.data.items_game_url!,
      time: job.data.time,
      consistent: job.data.items_game_url! === endUrl,
    };

    const multi = this.redis
      .multi()
      .hset(SCHEMAS_KEY, current.time, pack(current));

    const newest = await this.getSchemaOrNull();
    if (!newest || newest.time <= current.time) {
      // The schema is newer than the current one
      multi.set(CURRENT_SCHEMA_KEY, current.time);
    }

    await multi.exec();

    await this.eventsService.publish(
      SCHEMA_EVENT,
      current satisfies SchemaEvent['data'],
    );

    this.logger.log('Schema updated');

    if (!current.consistent) {
      // The schema has changed while we were processing it
      this.logger.warn(
        'Schema versions changed while updating it, retrying...',
      );
      await this.createJobs(SchemaRefreshAction.FORCE);
    }
  }

  /**
   * This method is called when the current schema url is fetched from Steam
   */
  async updateUrl(job: Job, url: string) {
    if (job.data.force !== true) {
      if (await this.isSameItemsGameUrl(url)) {
        // The schema is already up to date
        this.logger.debug('Schema is already up to date');
        return;
      }
    }

    // Start the other schema jobs
    await this.createSchemaJobs(job.data.time, url);
  }

  async updateOverview(job: Job, result: SchemaOverviewResponse) {
    // Start saving the overview
    const savingOverview = this.saveSchemaOverviewFile(result, job.data.time);

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

    const spellsByName: Record<string, Buffer> = {};
    const spellsById: Record<string, Buffer> = {};

    for (const attribute of result.attributes) {
      if (attribute.name.startsWith('SPELL: ')) {
        const spell = {
          id: attribute.defindex,
          name: attribute.description_string!,
        };

        const packed = pack(spell);

        spellsByName[Buffer.from(spell.name).toString('base64')] = packed;
        spellsById[spell.id.toString()] = packed;
      }
    }

    // Wait for the overview to be saved
    await savingOverview;

    const time = job.data.time;

    await this.redis
      .multi()
      .hmset(this.getKey(SCHEMA_QUALITIES_NAME_KEY, time), qualitiesByName)
      .hmset(this.getKey(SCHEMA_QUALITIES_ID_KEY, time), qualitiesById)
      .hmset(this.getKey(SCHEMA_EFFECTS_NAME_KEY, time), effectsByName)
      .hmset(this.getKey(SCHEMA_EFFECTS_ID_KEY, time), effectsById)
      .hmset(this.getKey(SPELLS_NAME_KEY, time), spellsByName)
      .hmset(this.getKey(SPELLS_ID_KEY, time), spellsById)
      .exec();
  }

  async updateItems(job: Job, result: GetSchemaItemsResponse) {
    if (result.next) {
      // There are more items to fetch
      await this.createItemsJob(job, result.next);
    }

    const defindexToItem: Record<string, Buffer> = {};
    const nameToDefindex: Record<string, Set<number>> = {};

    for (const item of result.items) {
      const defindex = item.defindex;

      // Save the item to the defindex key
      defindexToItem[defindex] = pack(item);

      const nameBuffer = Buffer.from(item.item_name).toString('base64');

      // Keep track of the defindexes for each name
      if (nameToDefindex[nameBuffer] === undefined) {
        nameToDefindex[nameBuffer] = new Set<number>();
      }
      nameToDefindex[nameBuffer].add(defindex);
    }

    // Save the schema items
    const multi = this.redis
      .multi()
      .hmset(this.getKey(SCHEMA_ITEMS_KEY, job.data.time), defindexToItem);

    const keys = Object.keys(nameToDefindex);

    // Save to a variable to reuse later
    const schemaItemsNameKey = this.getKey(
      SCHEMA_ITEMS_NAME_KEY,
      job.data.time,
    );

    const existing = await this.redis.hmgetBuffer(schemaItemsNameKey, ...keys);

    const nameToDefindexToSave: Record<string, Buffer> = {};

    // Merge existing into current ones
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const previous = existing[key];

      if (previous) {
        const defindexes = unpack(previous);
        for (const defindex of defindexes) {
          nameToDefindex[key].add(defindex);
        }
      }

      nameToDefindexToSave[key] = pack(Array.from(nameToDefindex[key]));
    }

    // Save the schema items to the name key
    multi.hmset(schemaItemsNameKey, nameToDefindexToSave);

    // Write the changes to the database
    await multi.exec();
  }

  async updateProtoObjDefs(job: Job, result: string) {
    const parsed = vdf(result);

    const protodefs = parsed.lang.Tokens;

    const paintkitsById: Record<string, Buffer> = {};
    const paintkitsByName: Record<string, Buffer> = {};

    const paintkits: PaintKit[] = [];

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

      paintkits.push({ id, name });
    }

    paintkits.sort((a, b) => a.id - b.id);

    for (let i = paintkits.length - 1; i >= 0; i--) {
      const paintkit = paintkits[i];
      const packed = pack(paintkit);

      paintkitsById[paintkit.id.toString()] = packed;
      paintkitsByName[Buffer.from(paintkit.name).toString('base64')] = packed;
    }

    await this.redis
      .multi()
      .hmset(this.getKey(PAINTKIT_ID_KEY, job.data.time), paintkitsById)
      .hmset(this.getKey(PAINTKIT_NAME_KEY, job.data.time), paintkitsByName)
      .exec();
  }

  async updateItemsGame(job: Job, result: string) {
    await this.saveSchemaItemsGameFile(result, job.data.time);
  }

  private async saveSchemaOverviewFile(
    result: SchemaOverviewResponse,
    time: number,
  ): Promise<void> {
    await this.storageService.write(
      time + '.' + OVERVIEW_FILE,
      pack(result).toString('base64'),
    );
  }

  private async getClosestSchemaByTime(time?: number): Promise<Schema> {
    const schemas = await this.getSchemas();

    if (schemas.length === 0) {
      throw new NotFoundException('Schema not found');
    }

    // Time is not defined, return the latest schema
    if (time === undefined) {
      return schemas[0];
    }

    // If the time is out of bounds then use the closest
    if (time >= schemas[0].time) {
      return schemas[0];
    }

    for (let i = 0; i < schemas.length; i++) {
      const schema = schemas[i];
      if (schema.time <= time) {
        return schema;
      }
    }

    return schemas[schemas.length - 1];
  }

  async getSchemaOverviewByTime(
    time?: number,
  ): Promise<SchemaOverviewResponse> {
    const schema = await this.getClosestSchemaByTime(time);
    return this.getSchemaOverviewBySchema(schema);
  }

  private async getSchemaOverviewBySchema(
    schema: Schema,
  ): Promise<SchemaOverviewResponse> {
    const overview = await this.storageService.read(
      schema.time + '.' + OVERVIEW_FILE,
    );
    if (!overview) {
      throw new NotFoundException('Schema overview not found');
    }

    return unpack(Buffer.from(overview, 'base64'));
  }

  private async saveSchemaItemsGameFile(
    result: string,
    time: number,
  ): Promise<void> {
    await this.storageService.write(time + '.' + ITEMS_GAME_FILE, result);
  }

  async getSchemaItemsGameByTime(time?: number): Promise<string> {
    const schema = await this.getClosestSchemaByTime(time);
    return this.getSchemaItemsGameBySchema(schema);
  }

  private async getSchemaItemsGameBySchema(schema: Schema): Promise<string> {
    const items = await this.storageService.read(
      schema.time + '.' + ITEMS_GAME_FILE,
    );
    if (!items) {
      throw new NotFoundException('Schema items not found');
    }

    return items;
  }

  private getKey(key: string, prefix: any, properties?: Record<string, any>) {
    if (properties) {
      for (const property in properties) {
        key = key.replace('<' + property + '>', properties[property]);
      }
    }
    return prefix + ':' + key;
  }
}
