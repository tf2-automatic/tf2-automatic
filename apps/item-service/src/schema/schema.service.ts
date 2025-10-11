import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis';
import {
  BOT_EXCHANGE_NAME,
  TF2_SCHEMA_EVENT,
  TF2SchemaEvent as BotSchemaEvent,
} from '@tf2-automatic/bot-data';
import { NestEventsService } from '@tf2-automatic/nestjs-events';
import { FlowProducer, Queue } from 'bullmq';
import Redis, { ChainableCommander } from 'ioredis';
import { Config, SchemaConfig } from '../common/config/configuration';
import { ConfigService } from '@nestjs/config';
import {
  JobData,
  GetSchemaItemsResponse,
  JobWithTypes as Job,
  SchemaOverviewResponse,
  TempSpell,
  SchemaLookupOptions,
  TempStrangePart,
  KillEaterScoreType,
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
  StrangePart,
  Paint,
  SchemaAttribute,
} from '@tf2-automatic/item-service-data';
import { parse as vdf } from 'kvparser';
import { NestStorageService } from '@tf2-automatic/nestjs-storage';
import { mergeDefinitionPrefab } from './schema.utils';
import { S3StorageEngine } from '@tf2-automatic/nestjs-storage';
import {
  EconParser,
  EconParserSchema,
  ItemNamingSchema,
  NameGenerator,
  TF2GCParser,
  TF2ParserSchema,
} from '@tf2-automatic/tf2-format';
import Dataloader from 'dataloader';
import assert from 'assert';
import { CursorPaginationResponse } from '@tf2-automatic/dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

type EnumPartialRecord<E extends Record<string, string | number>, T> = {
  [K in E[keyof E]]?: T;
};

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
  SPELLS_TEMP = 'schema:spells:temp',
  STRANGE_PART_KILLEATER_ID = 'schema:part:kill-eater:id',
  STRANGE_PART_KILLEATER_NAME = 'schema:part:kill-eater:name',
  KILL_EATER_ID_TEMP = 'schema:kill-eater:id:temp',
  STRANGE_PART_ID_TEMP = 'schema:part:id:temp',
  PAINT_COLOR = 'schema:paint:color',
}

const SCHEMA_KEYS_CASE_SENSITIVE: EnumPartialRecord<
  typeof SchemaKeys,
  boolean
> = {
  [SchemaKeys.ITEMS]: true,
  [SchemaKeys.ITEMS_NAME]: false,
  [SchemaKeys.ITEMS_GAME]: true,
  [SchemaKeys.QUALITIES_ID]: true,
  [SchemaKeys.QUALITIES_NAME]: false,
  [SchemaKeys.EFFECTS_ID]: true,
  [SchemaKeys.EFFECTS_NAME]: false,
  [SchemaKeys.PAINTKIT_ID]: true,
  [SchemaKeys.PAINTKIT_NAME]: false,
  [SchemaKeys.SPELLS_ID]: true,
  [SchemaKeys.SPELLS_NAME]: false,
  [SchemaKeys.SPELLS_TEMP]: true,
  [SchemaKeys.STRANGE_PART_KILLEATER_ID]: true,
  [SchemaKeys.STRANGE_PART_KILLEATER_NAME]: false,
  [SchemaKeys.KILL_EATER_ID_TEMP]: true,
  [SchemaKeys.STRANGE_PART_ID_TEMP]: true,
  [SchemaKeys.PAINT_COLOR]: false,
};

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

const SHEENS = {
  'Team Shine': 1,
  'Deadly Daffodil': 2,
  Manndarin: 3,
  'Mean Green': 4,
  'Agonizing Emerald': 5,
  'Villainous Violet': 6,
  'Hot Rod': 7,
};

const KILLSTREAKERS = {
  'Fire Horns': 2002,
  'Cerebral Discharge': 2003,
  Tornado: 2004,
  Flames: 2005,
  Singularity: 2006,
  Incinerator: 2007,
  'Hypno-Beam': 2008,
};

@Injectable()
export class SchemaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaService.name);

  private readonly updateTimeout =
    this.configService.getOrThrow<SchemaConfig>('schema').updateTimeout;

  private readonly producer: FlowProducer = new FlowProducer(this.queue.opts);

  private readonly redis: Redis = this.redisService.getOrThrow();

  constructor(
    @InjectQueue('schema')
    private readonly queue: Queue<JobData>,
    private readonly redisService: RedisService,
    private readonly eventsService: NestEventsService,
    private readonly configService: ConfigService<Config>,
    private readonly storageService: NestStorageService,
    private readonly httpService: HttpService,
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
    cursor = 0,
    count = 1000,
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
  ): Promise<CursorPaginationResponse<T>> {
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

  private async getValueByField<T>(
    key: SchemaKeys,
    hash: string,
    options?: SchemaLookupOptions,
  ): Promise<T> {
    const matches = await this.getValuesByField<T>(key, [hash], options);

    const result = matches[hash];
    if (!result) {
      throw new NotFoundException('Not found');
    }

    return result;
  }

  private async getValuesByFieldAndTime<T>(
    key: SchemaKeys,
    fields: readonly string[],
    time: number,
  ): Promise<Record<string, T>> {
    if (fields.length === 0) {
      return {};
    }

    const sensitive = SCHEMA_KEYS_CASE_SENSITIVE[key]
      ? fields
      : fields.map((field) => field.toLowerCase());

    const result = await this.redis.hmgetBuffer(
      this.getKey(key, time),
      ...sensitive,
    );

    const items: Record<string, T> = {};

    for (let i = 0; i < fields.length; i++) {
      const value = result[i];
      if (value !== null) {
        items[fields[i]] = unpack(value) as T;
      }
    }

    return items;
  }

  private async getValuesByTime<T>(
    key: SchemaKeys,
    time: number,
  ): Promise<Record<string, T>> {
    const result = await this.redis.hgetallBuffer(this.getKey(key, time));

    const items: Record<string, T> = {};

    for (const field in result) {
      items[field] = unpack(result[field]) as T;
    }

    return items;
  }

  private async getValuesByField<T>(
    key: SchemaKeys,
    fields: readonly string[],
    options?: SchemaLookupOptions,
  ): Promise<Record<string, T>> {
    if (fields.length === 0) {
      return {};
    }

    assert(
      options?.time !== undefined || options?.useClosestSchema !== false,
      'Either time must be set or useClosestSchema must not be set to false',
    );

    let time = options?.time;
    if (options?.useClosestSchema !== false || time === undefined) {
      const schema = await this.getClosestSchemaByTime(options?.time);
      time = schema.time;
    }

    return this.getValuesByFieldAndTime<T>(key, fields, time);
  }

  async getItemByDefindex(
    defindex: string,
    useItemsGame: true,
    options?: SchemaLookupOptions,
  ): Promise<ItemsGameItem>;
  async getItemByDefindex(
    defindex: string,
    useItemsGame: false,
    options?: SchemaLookupOptions,
  ): Promise<SchemaItem>;
  async getItemByDefindex(
    defindex: string,
    useItemsGame?: boolean,
    options?: SchemaLookupOptions,
  ): Promise<SchemaItem | ItemsGameItem>;
  async getItemByDefindex(
    defindex: string,
    useItemsGame = false,
    options?: SchemaLookupOptions,
  ): Promise<SchemaItem | ItemsGameItem> {
    const items = await this.getItemsByDefindexes(
      [defindex],
      useItemsGame,
      options,
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
    options?: SchemaLookupOptions,
  ): Promise<ItemsGameItem[]>;
  async getItemsByName(
    name: string,
    useItemsGame: false,
    options?: SchemaLookupOptions,
  ): Promise<SchemaItem[]>;
  async getItemsByName(
    name: string,
    useItemsGame: boolean,
    options?: SchemaLookupOptions,
  ): Promise<SchemaItem[] | ItemsGameItem[]>;
  async getItemsByName(
    name: string,
    useItemsGame = false,
    options?: SchemaLookupOptions,
  ): Promise<SchemaItem[] | ItemsGameItem[]> {
    const matches = await this.getItemsByNames([name], useItemsGame, options);
    return matches[name] ?? [];
  }

  async getItemsByNames(
    names: readonly string[],
    useItemsGame: true,
    options?: SchemaLookupOptions,
  ): Promise<Record<string, ItemsGameItem[]>>;
  async getItemsByNames(
    names: readonly string[],
    useItemsGame: false,
    options?: SchemaLookupOptions,
  ): Promise<Record<string, SchemaItem[]>>;
  async getItemsByNames(
    names: readonly string[],
    useItemsGame: boolean,
    options?: SchemaLookupOptions,
  ): Promise<Record<string, SchemaItem[]> | Record<string, ItemsGameItem[]>>;
  async getItemsByNames(
    names: readonly string[],
    useItemsGame = false,
    options?: SchemaLookupOptions,
  ): Promise<Record<string, (SchemaItem | ItemsGameItem)[]>> {
    const defindexesByName = await this.getValuesByField<string[]>(
      SchemaKeys.ITEMS_NAME,
      names,
      options,
    );

    const defindexes = new Set<string>();
    for (const name in defindexesByName) {
      const defindexesForName = defindexesByName[name] ?? [];
      defindexesForName.forEach((defindex) =>
        defindexes.add(defindex.toString()),
      );
    }

    const items = await this.getItemsByDefindexes(
      Array.from(defindexes.values()),
      useItemsGame,
      options,
    );

    const result:
      | Record<string, SchemaItem[]>
      | Record<string, ItemsGameItem[]> = {};

    for (const name of names) {
      const defindexesForName = defindexesByName[name] ?? [];
      const resultForName: SchemaItem[] | ItemsGameItem[] = [];

      for (let i = 0; i < defindexesForName.length; i++) {
        const defindex = defindexesForName[i];
        const item = items[defindex];
        if (item) {
          resultForName.push(item as never);
        }
      }

      if (useItemsGame) {
        (resultForName as ItemsGameItem[]).sort(
          (a, b) => Number(a.def_index) - Number(b.def_index),
        );
      } else {
        (resultForName as SchemaItem[]).sort((a, b) => a.defindex - b.defindex);
      }

      result[name] = resultForName;
    }

    return result;
  }

  private async getItemsByDefindexes(
    defindexes: string[],
    useItemsGame: true,
    options?: SchemaLookupOptions,
  ): Promise<Record<string, ItemsGameItem>>;
  private async getItemsByDefindexes(
    defindexes: string[],
    useItemsGame: false,
    options?: SchemaLookupOptions,
  ): Promise<Record<string, SchemaItem>>;
  private async getItemsByDefindexes(
    defindexes: string[],
    useItemsGame: boolean,
    options?: SchemaLookupOptions,
  ): Promise<Record<string, SchemaItem> | Record<string, ItemsGameItem>>;
  private async getItemsByDefindexes(
    defindexes: string[],
    useItemsGame = false,
    options?: SchemaLookupOptions,
  ): Promise<Record<string, SchemaItem | ItemsGameItem>> {
    return this.getValuesByField<SchemaItem | ItemsGameItem>(
      useItemsGame ? SchemaKeys.ITEMS_GAME : SchemaKeys.ITEMS,
      defindexes,
      options,
    );
  }

  async getQualityById(
    id: string,
    options?: SchemaLookupOptions,
  ): Promise<Quality> {
    return this.getValueByField(SchemaKeys.QUALITIES_ID, id, options);
  }

  async getQualityByName(
    name: string,
    options?: SchemaLookupOptions,
  ): Promise<Quality> {
    return this.getValueByField(SchemaKeys.QUALITIES_NAME, name, options);
  }

  async getEffectById(
    id: string,
    options?: SchemaLookupOptions,
  ): Promise<AttachedParticle> {
    return this.getValueByField(SchemaKeys.EFFECTS_ID, id, options);
  }

  async getEffectByName(
    name: string,
    options?: SchemaLookupOptions,
  ): Promise<AttachedParticle> {
    return this.getValueByField(SchemaKeys.EFFECTS_NAME, name, options);
  }

  async getPaintKitById(
    id: string,
    options?: SchemaLookupOptions,
  ): Promise<PaintKit> {
    return this.getValueByField(SchemaKeys.PAINTKIT_ID, id, options);
  }

  async getPaintKitByName(
    name: string,
    options?: SchemaLookupOptions,
  ): Promise<PaintKit> {
    return this.getValueByField(SchemaKeys.PAINTKIT_NAME, name, options);
  }

  async getSpellByAttribute(
    id: string,
    options?: SchemaLookupOptions,
  ): Promise<Spell> {
    return this.getValueByField(SchemaKeys.SPELLS_ID, id, options);
  }

  async getSpellByName(
    name: string,
    options?: SchemaLookupOptions,
  ): Promise<Spell> {
    return this.getValueByField<Spell>(SchemaKeys.SPELLS_NAME, name, options);
  }

  async getStrangePartByScoreType(
    id: string,
    options?: SchemaLookupOptions,
  ): Promise<StrangePart> {
    return this.getValueByField(
      SchemaKeys.STRANGE_PART_KILLEATER_ID,
      id,
      options,
    );
  }

  async getStrangePartByScoreTypeName(
    name: string,
    options?: SchemaLookupOptions,
  ): Promise<StrangePart> {
    return this.getValueByField(
      SchemaKeys.STRANGE_PART_KILLEATER_NAME,
      name,
      options,
    );
  }

  async getPaintByColor(
    color: string,
    options?: SchemaLookupOptions,
  ): Promise<Paint> {
    return this.getValueByField(SchemaKeys.PAINT_COLOR, color, options);
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
    assert(job.parent, 'Job has no parent');
    assert(job.parent.id, 'Parent has no id');

    return this.queue.add(
      'items',
      {
        time: job.data.time,
        start,
      },
      {
        parent: {
          id: job.parent.id,
          queue: job.queueQualifiedName,
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

  private setManyValuesByFields(
    multi: ChainableCommander,
    time: number,
    data: EnumPartialRecord<typeof SchemaKeys, Record<string, Buffer>>,
  ) {
    for (const key in data) {
      this.setValuesByFields(multi, key as SchemaKeys, time, data[key]);
    }
  }

  private setValuesByFields(
    multi: ChainableCommander,
    key: SchemaKeys,
    time: number,
    object: Record<string, Buffer>,
  ) {
    if (Object.keys(object).length === 0) {
      return;
    }

    let save: Record<string, Buffer> = object;

    if (!SCHEMA_KEYS_CASE_SENSITIVE[key]) {
      const copy: Record<string, Buffer> = {};

      for (const field in object) {
        copy[field.toLowerCase()] = object[field];
      }

      save = copy;
    }

    multi.hmset(this.getKey(key, time), save);
  }

  private async finishSpells(
    multi: ChainableCommander,
    time: number,
  ): Promise<void> {
    // Get all temp spells
    const tempSpells = await this.redis
      .hvalsBuffer(this.getKey(SchemaKeys.SPELLS_TEMP, time))
      .then((values) => values.map((value) => unpack(value) as TempSpell));

    const options: SchemaLookupOptions = {
      time,
      // We want to use the exact time because the schema is not yet created
      useClosestSchema: false,
    };

    // Get attributes by their defindex
    const attributes = await this.getSchemaOverviewUrl(options)
      .then((url) => {
        return firstValueFrom(
          this.httpService.get<SchemaOverviewResponse>(url),
        );
      })
      .then((response) => {
        const attributes = response.data.attributes;
        const attributesByDefindex: Record<number, SchemaAttribute> = {};
        for (const attribute of attributes) {
          attributesByDefindex[attribute.defindex] = attribute;
        }
        return attributesByDefindex;
      });

    const spellsByName: Record<string, Buffer> = {};
    const spellsByAttribute: Record<string, Buffer> = {};

    // Create list of spells based on the temp spells and the matching items
    for (const tempSpell of tempSpells) {
      const attribute = attributes[tempSpell.attribute];
      if (!attribute) {
        // This should not happen
        this.logger.warn(
          `Spell attribute with defindex ${tempSpell.attribute} not found?`,
        );
        continue;
      }

      let name = '';

      if (
        attribute.description_format === 'value_is_from_lookup_table' &&
        tempSpell.defindexes.length > 0
      ) {
        // Get name from defindexes (I am lazy and just do it one at a time...)
        const item = await this.getItemByDefindex(
          tempSpell.defindexes[0].toString(),
          false,
          options,
        );
        // Remove "Halloween Spell: "
        name = item.item_name.slice(17);
      } else if (
        attribute.description_format === 'value_is_additive' &&
        attribute.description_string
      ) {
        // Should be defined, but we check it anyway
        name = attribute.description_string;
      }

      const spell: Spell = {
        defindexes: tempSpell.defindexes,
        name,
        attribute: tempSpell.attribute,
        value: tempSpell.value,
      };

      const packed = pack(spell);
      spellsByName[spell.name] = packed;
      spellsByAttribute[spell.attribute + '_' + spell.value] = packed;
    }

    this.setManyValuesByFields(multi, time, {
      [SchemaKeys.SPELLS_NAME]: spellsByName,
      [SchemaKeys.SPELLS_ID]: spellsByAttribute,
    });

    multi.del(this.getKey(SchemaKeys.SPELLS_TEMP, time));
  }

  private async finishStrangeParts(
    multi: ChainableCommander,
    time: number,
  ): Promise<void> {
    const [tempParts, killEaterScoreTypes] = await Promise.all([
      this.getValuesByTime<TempStrangePart>(
        SchemaKeys.STRANGE_PART_ID_TEMP,
        time,
      ),
      this.getValuesByTime<KillEaterScoreType>(
        SchemaKeys.KILL_EATER_ID_TEMP,
        time,
      ),
    ]);

    const strangePartsById: Record<string, Buffer> = {};
    const strangePartsByName: Record<string, Buffer> = {};

    for (const id in tempParts) {
      const tempPart = tempParts[id];
      const scoreType = killEaterScoreTypes[tempPart.id.toString()];
      if (!scoreType) {
        // This should not happen, but we check it anyway
        this.logger.warn(
          `Kill eater score type with id ${tempPart.id} not found?`,
        );
        continue;
      }

      const strangePart: StrangePart = {
        id: tempPart.id,
        defindex: tempPart.defindex,
        type: scoreType.type_name,
      };

      const packed = pack(strangePart);

      strangePartsById[strangePart.id.toString()] = packed;
      strangePartsByName[strangePart.type] = packed;
    }

    multi
      .del(this.getKey(SchemaKeys.STRANGE_PART_ID_TEMP, time))
      .del(this.getKey(SchemaKeys.KILL_EATER_ID_TEMP, time));

    this.setManyValuesByFields(multi, time, {
      [SchemaKeys.STRANGE_PART_KILLEATER_ID]: strangePartsById,
      [SchemaKeys.STRANGE_PART_KILLEATER_NAME]: strangePartsByName,
    });
  }

  /**
   * This method is called when all schema jobs have finished
   * @param job
   */
  async updateSchema(job: Job, endUrl: string) {
    assert(job.data.items_game_url, 'Items game url is not set');

    const current: Schema = {
      version: job.data.items_game_url,
      time: job.data.time,
      consistent: job.data.items_game_url === endUrl,
    };

    const multi = this.redis
      .multi()
      .hset(SCHEMAS_KEY, current.time, pack(current));

    await Promise.all([
      this.finishSpells(multi, current.time),
      this.finishStrangeParts(multi, current.time),
    ]);

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

      if (
        effectsByName[effect.name] === undefined ||
        effect.system.endsWith('teamcolor_red')
      ) {
        // Some effects have the same name, but different "system" because they depend on the team
        // In TF2 the red team is for some reason prioritized, also for paints...
        effectsByName[effect.name] = packed;
      }

      effectsById[effect.id.toString()] = packed;
    }

    const scoreTypesById: Record<string, Buffer> = {};

    for (const attribute of result.kill_eater_score_types) {
      const packed = pack(attribute);
      scoreTypesById[attribute.type.toString()] = packed;
    }

    // Wait for the overview to be saved
    await savingOverview;

    const time = job.data.time;

    const multi = this.redis.multi();

    this.setManyValuesByFields(multi, time, {
      [SchemaKeys.QUALITIES_NAME]: qualitiesByName,
      [SchemaKeys.QUALITIES_ID]: qualitiesById,
      [SchemaKeys.EFFECTS_NAME]: effectsByName,
      [SchemaKeys.EFFECTS_ID]: effectsById,
      [SchemaKeys.KILL_EATER_ID_TEMP]: scoreTypesById,
    });

    await multi.exec();
  }

  async updateItems(job: Job, result: GetSchemaItemsResponse) {
    if (result.next) {
      // There are more items to fetch
      await this.createItemsJob(job, result.next);
    }

    const defindexToItem: Record<string, Buffer> = {};
    const nameToDefindex: Record<string, Set<number>> = {};

    const strangePartByScoreType: Record<string, Buffer> = {};
    const paintByColor: Record<string, Buffer> = {};

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
            defindex,
          } satisfies TempStrangePart);
        }
      }

      if (item.item_class === 'tool' && item.tool?.type === 'paint_can') {
        const primaryColor = item.attributes?.find(
          (attribute) => attribute.name === 'set item tint RGB',
        );

        if (primaryColor) {
          const secondaryColor = item.attributes?.find(
            (attribute) => attribute.name === 'set item tint RGB 2',
          );

          const paint: Paint = {
            defindex: item.defindex,
            primaryColor: primaryColor.value.toString(16),
            secondaryColor: null,
          };

          if (secondaryColor) {
            paint.secondaryColor = secondaryColor.value.toString(16);
          }

          const packed = pack(paint);

          paintByColor[paint.primaryColor] = packed;
          if (paint.secondaryColor) {
            paintByColor[paint.secondaryColor] = packed;
          }
        }
      }
    }

    // Save the schema items
    const multi = this.redis.multi();

    const keys = Object.keys(nameToDefindex);

    const existing = await this.getValuesByFieldAndTime<number[]>(
      SchemaKeys.ITEMS_NAME,
      keys,
      job.data.time,
    );

    const nameToDefindexToSave: Record<string, Buffer> = {};

    // Merge existing into current ones
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const previous = existing[key];

      if (previous) {
        for (const defindex of previous) {
          nameToDefindex[key].add(defindex);
        }
      }

      nameToDefindexToSave[key] = pack(Array.from(nameToDefindex[key]));
    }

    this.setManyValuesByFields(multi, job.data.time, {
      [SchemaKeys.ITEMS]: defindexToItem,
      [SchemaKeys.STRANGE_PART_ID_TEMP]: strangePartByScoreType,
      [SchemaKeys.PAINT_COLOR]: paintByColor,
      [SchemaKeys.ITEMS_NAME]: nameToDefindexToSave,
    });

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

    const multi = this.redis.multi();

    this.setManyValuesByFields(multi, job.data.time, {
      [SchemaKeys.PAINTKIT_ID]: paintkitsById,
      [SchemaKeys.PAINTKIT_NAME]: paintkitsByName,
    });

    await multi.exec();
  }

  async updateItemsGame(job: Job, result: string) {
    await this.saveSchemaItemsGameFile(result, job.data.time);

    const parsed = vdf(result);

    const items = parsed.items_game.items as Record<string, ItemsGameItem>;
    const prefabs = parsed.items_game.prefabs as Record<
      string,
      Partial<ItemsGameItem>
    >;
    const attributes = parsed.items_game.attributes as Record<
      string,
      {
        name: string;
      }
    >;

    const attributeByName: Record<string, number> = {};
    for (const defindexString in attributes) {
      const defindex = parseInt(defindexString, 10);
      if (isNaN(defindex)) {
        continue;
      }

      const attribute = attributes[defindexString];
      attributeByName[attribute.name] = defindex;
    }

    const chunkSize = 100;

    const keys = Object.keys(items);
    let index = 0;

    const spellsByAttributeKey: Record<string, TempSpell> = {};

    while (index < keys.length) {
      const chunk: Record<string, Buffer> = {};

      for (let i = index; i < Math.min(index + chunkSize, keys.length); i++) {
        const defindexString = keys[i];
        const defindex = parseInt(defindexString, 10);
        if (isNaN(defindex)) {
          continue;
        }

        const element = items[defindexString];

        const item: Partial<ItemsGameItem> = {};

        mergeDefinitionPrefab(item, element, prefabs);

        item.def_index = defindexString;
        delete item.prefab;

        chunk[defindex] = pack(item);

        if (
          item.name?.startsWith('Halloween Spell: ') &&
          item?.tool?.usage?.attributes !== undefined
        ) {
          // Look for attributes starting with "SPELL: "
          for (const name in item.tool.usage.attributes) {
            if (!name.startsWith('SPELL: ')) {
              continue;
            }

            const attributeValue = parseInt(item.tool.usage.attributes[name]);
            if (isNaN(attributeValue)) {
              continue;
            }

            const key = attributeByName[name] + '_' + attributeValue;

            let existing = spellsByAttributeKey[key];
            if (!existing) {
              existing = spellsByAttributeKey[key] = {
                defindexes: [],
                attribute: attributeByName[name],
                value: attributeValue,
              };
            }
            existing.defindexes.push(defindex);
            break;
          }
        }
      }

      const multi = this.redis.multi();

      this.setManyValuesByFields(multi, job.data.time, {
        [SchemaKeys.ITEMS_GAME]: chunk,
      });

      await multi.exec();

      index += chunkSize;
    }

    const multi = this.redis.multi();

    if (Object.keys(spellsByAttributeKey).length > 0) {
      const save: Record<string, Buffer> = {};
      for (const key in spellsByAttributeKey) {
        save[key] = pack(spellsByAttributeKey[key]);
      }

      this.setManyValuesByFields(multi, job.data.time, {
        [SchemaKeys.SPELLS_TEMP]: save,
      });
    }

    await multi.exec();
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

  private async saveSchemaItemsGameFile(
    result: string,
    time: number,
  ): Promise<void> {
    await this.storageService.write(time + '.' + ITEMS_GAME_FILE, result);
  }

  async getSchemaOverviewUrl(options?: SchemaLookupOptions): Promise<string> {
    return this.getSignedUrl(OVERVIEW_FILE, options);
  }

  async getSchemaItemsGameUrl(options?: SchemaLookupOptions): Promise<string> {
    return this.getSignedUrl(ITEMS_GAME_FILE, options);
  }

  private async getSignedUrl(
    file: string,
    options?: SchemaLookupOptions,
  ): Promise<string> {
    assert(
      options?.time !== undefined || options?.useClosestSchema !== false,
      'Either time must be set or useClosestSchema must not be set to false',
    );

    let time = options?.time;
    if (options?.useClosestSchema !== false || time === undefined) {
      const schema = await this.getClosestSchemaByTime(options?.time);
      time = schema.time;
    }

    const engine = this.storageService.getEngine() as S3StorageEngine;
    const path = this.storageService.getPath(time + '.' + file);
    return engine.getSignedUrl(path);
  }

  private getKey(key: string, prefix: string | number) {
    return prefix + ':' + key.toString();
  }

  private getTF2ParserSchema(options?: SchemaLookupOptions): TF2ParserSchema {
    const itemLoader = new Dataloader<number, ItemsGameItem>(
      async (defindexes) => {
        const strings = defindexes.map((defindex) => defindex.toString());

        const match = await this.getItemsByDefindexes(strings, true, options);

        const items = new Array(defindexes.length);

        for (let i = 0; i < defindexes.length; i++) {
          const defindex = defindexes[i];
          if (!match[defindex]) {
            throw new NotFoundException('Item not found');
          }

          items[i] = match[defindex];
        }

        return items;
      },
    );

    const paintLoader = this.getPaintLoader(options);
    const strangePartLoader = this.getStrangePartLoader(false, options);

    return {
      getItemsGameItemByDefindex: () => undefined,
      fetchItemsGameItemByDefindex: async (defindex: number) =>
        itemLoader.load(defindex),
      getPaintByColor: () => undefined,
      fetchPaintByColor: (color: string) =>
        paintLoader.load(color).then((paint) => paint.defindex),
      getStrangePartById: () => undefined,
      fetchStrangePartById: (id: number) =>
        strangePartLoader
          .load(id.toString())
          .then((strangePart) => strangePart?.defindex ?? null),
    };
  }

  getTF2Parser(options?: SchemaLookupOptions): TF2GCParser {
    return new TF2GCParser(this.getTF2ParserSchema(options));
  }

  private getEconParserSchema(options?: SchemaLookupOptions): EconParserSchema {
    const itemByDefindexLoader = this.getItemByDefindexLoader(true, options);

    const itemByNameLoader = new Dataloader<string, number>(
      async (names) => {
        const matches = await this.getItemsByNames(names, false, options);

        const result: (number | Error)[] = new Array(names.length);

        for (let i = 0; i < names.length; i++) {
          const name = names[i];
          const items = matches[name];

          if (items.length === 0) {
            result[i] = new NotFoundException(
              `Item with name "${name}" not found`,
            );
          }

          let match = items[0];

          for (let i = 0; i < items.length; i++) {
            const element = items[i];
            if (
              element.name ===
              'Upgradeable ' + element.item_class.toUpperCase()
            ) {
              match = element;
              break;
            }
          }

          result[i] = match.defindex;
        }

        return result;
      },
      { batch: true },
    );

    const qualityLoader = this.getQualityLoader(true, options);
    const effectLoader = this.getEffectLoader(true, options);
    const paintkitLoader = this.getPaintkitLoader(true, options);
    const spellLoader = this.getSpellLoader(true, options);
    const strangePartLoader = this.getStrangePartLoader(true, options);

    return {
      getItemsGameItemByDefindex: () => undefined,
      fetchItemsGameItemByDefindex: async (defindex: number) => {
        return itemByDefindexLoader.load(defindex);
      },
      getDefindexByName: () => undefined,
      fetchDefindexByName: async (name: string) => {
        return itemByNameLoader.load(name);
      },
      getQualityByName: () => undefined,
      fetchQualityByName: async (name: string) => {
        return qualityLoader.load(name).then((quality) => quality.id);
      },
      getEffectByName: () => undefined,
      fetchEffectByName: async (name: string) => {
        return effectLoader.load(name).then((effect) => effect.id);
      },
      getTextureByName: () => undefined,
      fetchTextureByName: async (name: string) => {
        return paintkitLoader.load(name).then((paintkit) => paintkit.id);
      },
      getStrangePartByScoreType: () => undefined,
      fetchStrangePartByScoreType: async (name: string) => {
        return strangePartLoader
          .load(name)
          .then((part) => part?.defindex ?? null);
      },
      getSpellByName: () => undefined,
      fetchSpellByName: async (name: string) => {
        return spellLoader
          .load(name)
          .then((spell) => [spell.attribute, spell.value]);
      },
      getSheenByName: (name: string) => SHEENS[name],
      fetchSheenByName: () => {
        throw new Error('Method not implemented.');
      },
      getKillstreakerByName: (name: string) => KILLSTREAKERS[name],
      fetchKillstreakerByName: () => {
        throw new Error('Method not implemented.');
      },
    };
  }

  getEconParser(options?: SchemaLookupOptions): EconParser {
    return new EconParser(this.getEconParserSchema(options));
  }

  private getNameGeneratorSchema(
    options?: SchemaLookupOptions,
  ): ItemNamingSchema {
    const itemByDefindexLoader = this.getItemByDefindexLoader(false, options);
    const qualityLoader = this.getQualityLoader(false, options);
    const effectLoader = this.getEffectLoader(false, options);
    const paintkitLoader = this.getPaintkitLoader(false, options);

    return {
      getSchemaItemByDefindex: () => undefined,
      fetchSchemaItemByDefindex: (defindex) =>
        itemByDefindexLoader.load(defindex),
      getQualityById: () => undefined,
      fetchQualityById: (id) =>
        qualityLoader.load(id.toString()).then((quality) => quality.name),
      getEffectById: () => undefined,
      fetchEffectById: (id) =>
        effectLoader.load(id.toString()).then((effect) => effect.name),
      getPaintkitById: () => undefined,
      fetchPaintkitById: (id) =>
        paintkitLoader.load(id.toString()).then((paintkit) => paintkit.name),
    };
  }

  getNameGenerator(options?: SchemaLookupOptions): NameGenerator {
    return new NameGenerator(this.getNameGeneratorSchema(options));
  }

  private getItemByDefindexLoader(
    useItemsGame: true,
    options?: SchemaLookupOptions,
  ): Dataloader<number, ItemsGameItem>;
  private getItemByDefindexLoader(
    useItemsGame: false,
    options?: SchemaLookupOptions,
  ): Dataloader<number, SchemaItem>;
  private getItemByDefindexLoader(
    useItemsGame: boolean,
    options?: SchemaLookupOptions,
  ) {
    return new Dataloader<number, SchemaItem | ItemsGameItem>(
      async (defindexes) => {
        const items = await this.getItemsByDefindexes(
          defindexes.map((defindex) => defindex.toString()),
          useItemsGame,
          options,
        );

        const result = new Array(defindexes.length);

        for (let i = 0; i < defindexes.length; i++) {
          const defindex = defindexes[i];
          const match = items[defindex];
          result[i] = match ? match : new NotFoundException('Item not found');
        }

        return result;
      },
    );
  }

  private getQualityLoader(byName: boolean, options?: SchemaLookupOptions) {
    return this.getLoader<Quality>(
      byName ? SchemaKeys.QUALITIES_NAME : SchemaKeys.QUALITIES_ID,
      options,
    );
  }

  private getEffectLoader(byName: boolean, options?: SchemaLookupOptions) {
    return this.getLoader<AttachedParticle>(
      byName ? SchemaKeys.EFFECTS_NAME : SchemaKeys.EFFECTS_ID,
      options,
    );
  }

  private getPaintkitLoader(byName: boolean, options?: SchemaLookupOptions) {
    return this.getLoader<PaintKit>(
      byName ? SchemaKeys.PAINTKIT_NAME : SchemaKeys.PAINTKIT_ID,
      options,
    );
  }

  private getPaintLoader(options?: SchemaLookupOptions) {
    return this.getLoader<Paint>(SchemaKeys.PAINT_COLOR, options);
  }

  private getSpellLoader(byName: boolean, options?: SchemaLookupOptions) {
    return this.getLoader<Spell>(
      byName ? SchemaKeys.SPELLS_NAME : SchemaKeys.SPELLS_ID,
      options,
    );
  }

  private getStrangePartLoader(byName: boolean, options?: SchemaLookupOptions) {
    return this.getLoader<StrangePart>(
      byName
        ? SchemaKeys.STRANGE_PART_KILLEATER_NAME
        : SchemaKeys.STRANGE_PART_KILLEATER_ID,
      options,
      true,
    );
  }

  private getLoader<T>(
    key: SchemaKeys,
    options?: SchemaLookupOptions,
    nullable?: false,
  ): Dataloader<string, T>;
  private getLoader<T>(
    key: SchemaKeys,
    options?: SchemaLookupOptions,
    nullable?: true,
  ): Dataloader<string, T | null>;
  private getLoader<T>(
    key: SchemaKeys,
    options?: SchemaLookupOptions,
    nullable?: boolean,
  ): Dataloader<string, T | null> {
    return new Dataloader<string, T | null>(async (fields) => {
      return this.getValuesByField<T>(key, fields, options).then((values) => {
        return fields.map((field) =>
          values[field]
            ? values[field]
            : nullable
              ? null
              : new NotFoundException(
                  'Could not find field "' + field + '" for key "' + key + '"',
                ),
        );
      });
    });
  }
}
