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
  SchemaOverviewResponse,
  KillEaterTypeScore,
} from './schema.types';
import { unpack, pack } from 'msgpackr';
import {
  AttachedParticle,
  PaintKit,
  Quality,
  Schema,
  SchemaItem,
  Spell,
  SchemaEvent,
  SCHEMA_EVENT,
  SchemaRefreshAction,
  ItemsGameItem,
  SchemaPaginatedResponse,
  StrangePart,
} from '@tf2-automatic/item-service-data';
import { parse as vdf } from 'kvparser';
import { NestStorageService } from '@tf2-automatic/nestjs-storage';
import { mergeDefinitionPrefab } from './schema.utils';
import { S3StorageEngine } from '@tf2-automatic/nestjs-storage';

enum SchemaKeys {
  ITEMS = 'schema:items',
  ITEMS_NAME = 'schema:items:name',
  ITEMS_GAME = 'schema:items-game',
  QUALITIES_ID = 'schema:qualities:id',
  QUALITIES_NAME = 'schema:qualities:name',
  EFFECTS_ID = 'schema:effects:id',
  EFFECTS_NAME = 'schema:effects:name',
  PAINTKIT_ID = 'schema:paintkit:id',
  PAINTKIT_NAME = 'schema:paintkit:name',
  SPELLS_ID = 'schema:spells:id',
  SPELLS_NAME = 'schema:spells:name',
  // Strange part defindex by kill eater score type
  STRANGE_PART_ID = 'schema:part:id',
  // Kill eater score type by name
  KILL_EATER_SCORE_TYPE_NAME = 'schema:kill-eater-score-type:name',
}

// A key that stores the current schema id
const CURRENT_SCHEMA_KEY = 'schema:current';
// A key that stores the
const SCHEMAS_KEY = 'schema:schemas';
// The last time the schema was checked
const LAST_CHECKED_KEY = 'schema:last-checked';

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

    multi.hdel(SCHEMAS_KEY, time.toString());

    for (const key in SchemaKeys) {
      multi.del(this.getKey(SchemaKeys[key], time));
    }

    await multi.exec();

    await this.storageService.delete(time + '.' + OVERVIEW_FILE);
    await this.storageService.delete(time + '.' + ITEMS_GAME_FILE);
  }

  async getItems(
    cursor: number,
    count: number,
    time?: number,
    useItemsGame = false,
  ) {
    return this.getHashesPaginated<SchemaItem>(
      useItemsGame ? SchemaKeys.ITEMS_GAME : SchemaKeys.ITEMS,
      cursor,
      count,
      time,
    );
  }

  private async getHashesPaginated<T>(
    key: SchemaKeys,
    cursor: number,
    count: number,
    time?: number,
  ): Promise<SchemaPaginatedResponse<T>> {
    const schema = await this.getClosestSchemaByTime(time);

    const [newCursor, elements] = await this.redis.hscanBuffer(
      this.getKey(key, schema.time),
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

  private async getValueByField(
    key: SchemaKeys,
    hash: string,
    time?: number,
  ): Promise<any> {
    const matches = await this.getValuesByField(key, [hash], time);

    const result = matches[hash];
    if (!result) {
      throw new NotFoundException('Not found');
    }

    return result;
  }

  private async getValuesByField(
    key: SchemaKeys,
    fields: string[],
    time?: number,
  ): Promise<Record<string, any>> {
    const schema = await this.getClosestSchemaByTime(time);

    const result = await this.redis.hmgetBuffer(
      this.getKey(key, schema.time),
      ...fields,
    );

    const items: Record<string, any> = {};

    for (let i = 0; i < fields.length; i++) {
      const value = result[i];
      if (value !== null) {
        items[fields[i]] = unpack(value);
      }
    }

    return items;
  }

  async getItemByDefindex(
    defindex: string,
    useItemsGame: true,
    time?: number,
  ): Promise<ItemsGameItem>;
  async getItemByDefindex(
    defindex: string,
    useItemsGame: false,
    time?: number,
  ): Promise<SchemaItem>;
  async getItemByDefindex(
    defindex: string,
    useItemsGame: boolean,
    time?: number,
  ): Promise<SchemaItem | ItemsGameItem>;
  async getItemByDefindex(
    defindex: string,
    useItemsGame = false,
    time?: number,
  ): Promise<SchemaItem | ItemsGameItem> {
    const items = await this.getItemsByDefindexes(
      [defindex],
      useItemsGame,
      time,
    );

    const match = items[defindex];
    if (!match) {
      throw new NotFoundException('Item not found');
    }

    return match;
  }

  async getItemsByName(
    name: string,
    useItemsGame: true,
    time?: number,
  ): Promise<ItemsGameItem[]>;
  async getItemsByName(
    name: string,
    useItemsGame: false,
    time?: number,
  ): Promise<SchemaItem[]>;
  async getItemsByName(
    name: string,
    useItemsGame: boolean,
    time?: number,
  ): Promise<SchemaItem[] | ItemsGameItem[]>;
  async getItemsByName(
    name: string,
    useItemsGame = false,
    time?: number,
  ): Promise<SchemaItem[] | ItemsGameItem[]> {
    const defindexes = await this.getValueByField(
      SchemaKeys.ITEMS_NAME,
      name,
      time,
    );
    return Object.values(
      await this.getItemsByDefindexes(defindexes, useItemsGame, time),
    );
  }

  private async getItemsByDefindexes(
    defindexes: string[],
    useItemsGame: true,
    time?: number,
  ): Promise<Record<string, ItemsGameItem>>;
  private async getItemsByDefindexes(
    defindexes: string[],
    useItemsGame: false,
    time?: number,
  ): Promise<Record<string, SchemaItem>>;
  private async getItemsByDefindexes(
    defindexes: string[],
    useItemsGame: boolean,
    time?: number,
  ): Promise<Record<string, SchemaItem> | Record<string, ItemsGameItem>>;
  private async getItemsByDefindexes(
    defindexes: string[],
    useItemsGame = false,
    time?: number,
  ): Promise<Record<string, SchemaItem | ItemsGameItem>> {
    const schema = await this.getClosestSchemaByTime(time);

    const match = await this.redis.hmgetBuffer(
      this.getKey(
        useItemsGame ? SchemaKeys.ITEMS_GAME : SchemaKeys.ITEMS,
        schema.time,
      ),
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
    return this.getValueByField(SchemaKeys.QUALITIES_ID, id, time);
  }

  async getQualityByName(name: string, time?: number): Promise<Quality> {
    return this.getValueByField(SchemaKeys.QUALITIES_NAME, name, time);
  }

  async getEffectById(id: string, time?: number): Promise<AttachedParticle> {
    return this.getValueByField(SchemaKeys.EFFECTS_ID, id, time);
  }

  async getEffectByName(
    name: string,
    time?: number,
  ): Promise<AttachedParticle> {
    return this.getValueByField(SchemaKeys.EFFECTS_NAME, name, time);
  }

  async getPaintKitById(id: string, time?: number): Promise<PaintKit> {
    return this.getValueByField(SchemaKeys.PAINTKIT_ID, id, time);
  }

  async getPaintKitByName(name: string, time?: number): Promise<PaintKit> {
    return this.getValueByField(SchemaKeys.PAINTKIT_NAME, name, time);
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

    const spellFromItems = await this.getItemByDefindex(id, false, time).catch(
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
      return {
        id: parseInt(id, 10),
        name: spellFromItems.item_name.slice(17),
      };
    }

    throw new NotFoundException('Spell not found');
  }

  private async getSpellByIdFromAttributes(
    id: string,
    time?: number,
  ): Promise<Spell> {
    return this.getValueByField(SchemaKeys.SPELLS_ID, id, time);
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
      false,
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
    return this.getValueByField(SchemaKeys.SPELLS_NAME, name, time);
  }

  async getStrangePartByScoreType(
    id: string,
    time?: number,
  ): Promise<StrangePart> {
    return this.getValueByField(SchemaKeys.STRANGE_PART_ID, id, time);
  }

  async getStrangePartByScoreTypeName(
    name: string,
    time?: number,
  ): Promise<StrangePart> {
    const killEater: KillEaterTypeScore = await this.getValueByField(
      SchemaKeys.KILL_EATER_SCORE_TYPE_NAME,
      name,
      time,
    );

    return this.getValueByField(
      SchemaKeys.STRANGE_PART_ID,
      killEater.type.toString(),
      time,
    );
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

      qualitiesByName[name] = packed;
      qualitiesById[id.toString()] = packed;
    }

    const effectsByName: Record<string, Buffer> = {};
    const effectsById: Record<string, Buffer> = {};

    for (const effect of result.attribute_controlled_attached_particles) {
      const packed = pack(effect);

      effectsByName[effect.name] = packed;
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

        spellsByName[spell.name] = packed;
        spellsById[spell.id.toString()] = packed;
      }
    }

    const scoreTypesByName: Record<string, Buffer> = {};

    for (const attribute of result.kill_eater_score_types) {
      const packed = pack(attribute);
      scoreTypesByName[attribute.type_name] = packed;
    }

    // Wait for the overview to be saved
    await savingOverview;

    const time = job.data.time;

    await this.redis
      .multi()
      .hmset(this.getKey(SchemaKeys.QUALITIES_NAME, time), qualitiesByName)
      .hmset(this.getKey(SchemaKeys.QUALITIES_ID, time), qualitiesById)
      .hmset(this.getKey(SchemaKeys.EFFECTS_NAME, time), effectsByName)
      .hmset(this.getKey(SchemaKeys.EFFECTS_ID, time), effectsById)
      .hmset(this.getKey(SchemaKeys.SPELLS_NAME, time), spellsByName)
      .hmset(this.getKey(SchemaKeys.SPELLS_ID, time), spellsById)
      .hmset(
        this.getKey(SchemaKeys.KILL_EATER_SCORE_TYPE_NAME, time),
        scoreTypesByName,
      )
      .exec();
  }

  async updateItems(job: Job, result: GetSchemaItemsResponse) {
    if (result.next) {
      // There are more items to fetch
      await this.createItemsJob(job, result.next);
    }

    const defindexToItem: Record<string, Buffer> = {};
    const nameToDefindex: Record<string, Set<number>> = {};

    const strangePartByScoreType: Record<string, Buffer> = {};

    for (const item of result.items) {
      const defindex = item.defindex;

      // Save the item to the defindex key
      defindexToItem[defindex] = pack(item);

      const name = item.item_name;

      // Keep track of the defindexes for each name
      if (nameToDefindex[name] === undefined) {
        nameToDefindex[name] = new Set<number>();
      }
      nameToDefindex[name].add(defindex);

      if (
        item.item_type_name === 'Strange Part' &&
        item.attributes !== undefined
      ) {
        const scoreType = item.attributes.find(
          (attribute) => attribute.name === 'strange part new counter ID',
        );

        if (scoreType) {
          strangePartByScoreType[scoreType.value.toString()] = pack({
            id: scoreType.value,
            name,
            defindex,
          } satisfies StrangePart);
        }
      }
    }

    // Save the schema items
    const multi = this.redis
      .multi()
      .hmset(this.getKey(SchemaKeys.ITEMS, job.data.time), defindexToItem);

    if (Object.keys(strangePartByScoreType).length > 0) {
      multi.hmset(
        this.getKey(SchemaKeys.STRANGE_PART_ID, job.data.time),
        strangePartByScoreType,
      );
    }

    const keys = Object.keys(nameToDefindex);

    // Save to a variable to reuse later
    const schemaItemsNameKey = this.getKey(
      SchemaKeys.ITEMS_NAME,
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
      paintkitsByName[paintkit.name] = packed;
    }

    await this.redis
      .multi()
      .hmset(this.getKey(SchemaKeys.PAINTKIT_ID, job.data.time), paintkitsById)
      .hmset(
        this.getKey(SchemaKeys.PAINTKIT_NAME, job.data.time),
        paintkitsByName,
      )
      .exec();
  }

  async updateItemsGame(job: Job, result: string) {
    await this.saveSchemaItemsGameFile(result, job.data.time);

    const parsed = vdf(result);

    const items = parsed.items_game.items as Record<string, ItemsGameItem>;
    const prefabs = parsed.items_game.prefabs as Record<
      string,
      Partial<ItemsGameItem>
    >;

    const chunkSize = 100;

    const keys = Object.keys(items);
    let index = 0;

    const key = this.getKey(SchemaKeys.ITEMS_GAME, job.data.time);

    while (index < keys.length) {
      const chunk: Record<string, any> = {};

      for (let i = index; i < Math.min(index + chunkSize, keys.length); i++) {
        const defindex = keys[i];
        const element = items[defindex];

        const item: Partial<ItemsGameItem> = {};

        mergeDefinitionPrefab(item, element, prefabs);

        item.def_index = defindex;
        delete item.prefab;

        chunk[defindex] = pack(item);
      }

      await this.redis.hmset(key, chunk);

      index += chunkSize;

      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  private async saveSchemaOverviewFile(
    result: SchemaOverviewResponse,
    time: number,
  ): Promise<void> {
    await this.storageService.write(
      time + '.' + OVERVIEW_FILE,
      JSON.stringify(result),
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

  async getSchemaOverviewUrlByTime(time?: number): Promise<string> {
    const schema = await this.getClosestSchemaByTime(time);
    const engine = this.storageService.getEngine() as S3StorageEngine;
    const path = this.storageService.getPath(schema.time + '.' + OVERVIEW_FILE);
    return engine.getSignedUrl(path);
  }

  private async saveSchemaItemsGameFile(
    result: string,
    time: number,
  ): Promise<void> {
    await this.storageService.write(time + '.' + ITEMS_GAME_FILE, result);
  }

  async getSchemaItemsGameUrlByTime(time?: number): Promise<string> {
    const schema = await this.getClosestSchemaByTime(time);
    const engine = this.storageService.getEngine() as S3StorageEngine;
    const path = this.storageService.getPath(
      schema.time + '.' + ITEMS_GAME_FILE,
    );
    return engine.getSignedUrl(path);
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
