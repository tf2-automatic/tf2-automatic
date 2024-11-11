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
} from '@tf2-automatic/item-service-data';
import { parse as vdf } from 'kvparser';
import { NestStorageService } from '@tf2-automatic/nestjs-storage';

// Keeps track of the current version of the schema
const ITEMS_GAME_URL_KEY = 'schema:items-game-url';
// The last time the schema was checked
const LAST_CHECKED_KEY = 'schema:last-checked';
// The last time the schema was updated
const LAST_UPDATED_KEY = 'schema:last-updated';
// All schema items are stored in a hash set with the defindex as the key
const SCHEMA_ITEMS_KEY = 'schema:items';
// All schema items are stored in a set with the name as the key and the defindex as the value(s)
const SCHEMA_ITEMS_NAME_KEY = 'schema:items:name:<name>';
// A key that stores the suffix of the current schema keys
const CURRENT_SCHEMA_KEY = 'schema:current';
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

  async getSchema(): Promise<Schema> {
    const [itemsGameUrl, lastChecked, lastUpdated] = await Promise.all([
      this.getItemsGameUrl(),
      this.redis.get(LAST_CHECKED_KEY),
      this.redis.get(LAST_UPDATED_KEY),
    ]);

    if (!itemsGameUrl || !lastChecked || !lastUpdated) {
      throw new NotFoundException('Schema not found');
    }

    const lastCheckedParsed = Math.floor(parseInt(lastChecked, 10) / 1000);
    const lastUpdatedParsed = Math.floor(parseInt(lastUpdated, 10) / 1000);

    return {
      itemsGameUrl,
      checkedAt: lastCheckedParsed,
      updatedAt: lastUpdatedParsed,
    };
  }

  async getItems(cursor: number, count: number): Promise<SchemaItemsResponse> {
    const currentKey = await this.getCurrentKeyAndError();

    const [newCursor, elements] = await this.redis.hscanBuffer(
      this.getSuffixedKey(SCHEMA_ITEMS_KEY, currentKey),
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
    const currentKey = await this.getCurrentKeyAndError();

    const match = await this.redis.hmgetBuffer(
      this.getSuffixedKey(SCHEMA_ITEMS_KEY, currentKey),
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

  async getQualityById(id: string): Promise<Quality> {
    const currentKey = await this.getCurrentKeyAndError();

    const quality = await this.redis.hgetBuffer(
      this.getSuffixedKey(SCHEMA_QUALITIES_ID_KEY, currentKey),
      id,
    );

    if (!quality) {
      throw new NotFoundException('Quality not found');
    }

    return unpack(quality);
  }

  async getQualityByName(name: string): Promise<Quality> {
    const currentKey = await this.getCurrentKeyAndError();

    const quality = await this.redis.hgetBuffer(
      this.getSuffixedKey(SCHEMA_QUALITIES_NAME_KEY, currentKey),
      Buffer.from(name).toString('base64'),
    );

    if (!quality) {
      throw new NotFoundException('Quality not found');
    }

    return unpack(quality);
  }

  async getEffectById(id: string): Promise<AttachedParticle> {
    const currentKey = await this.getCurrentKeyAndError();

    const effect = await this.redis.hgetBuffer(
      this.getSuffixedKey(SCHEMA_EFFECTS_ID_KEY, currentKey),
      id,
    );

    if (!effect) {
      throw new NotFoundException('Effect not found');
    }

    return unpack(effect);
  }

  async getEffectByName(name: string): Promise<AttachedParticle> {
    const currentKey = await this.getCurrentKeyAndError();

    const effect = await this.redis.hgetBuffer(
      this.getSuffixedKey(SCHEMA_EFFECTS_NAME_KEY, currentKey),
      Buffer.from(name).toString('base64'),
    );

    if (!effect) {
      throw new NotFoundException('Effect not found');
    }

    return unpack(effect);
  }

  async getPaintKitById(id: string): Promise<PaintKit> {
    const currentKey = await this.getCurrentKeyAndError();

    const paintkit = await this.redis.hgetBuffer(
      this.getSuffixedKey(PAINTKIT_ID_KEY, currentKey),
      id,
    );

    if (!paintkit) {
      throw new NotFoundException('Paintkit not found');
    }

    return unpack(paintkit);
  }

  async getPaintKitByName(name: string): Promise<PaintKit> {
    const currentKey = await this.getCurrentKeyAndError();

    const paintkit = await this.redis.hgetBuffer(
      this.getSuffixedKey(PAINTKIT_NAME_KEY, currentKey),
      Buffer.from(name).toString('base64'),
    );

    if (!paintkit) {
      throw new NotFoundException('Paintkit not found');
    }

    return unpack(paintkit);
  }

  async getSpellById(id: string): Promise<Spell> {
    const spellFromAttribute = await this.getSpellByIdFromAttributes(id).catch(
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

    if (spellFromAttribute) {
      return spellFromAttribute;
    }

    const spellFromItems = await this.getItemByDefindex(id).catch((err) => {
      if (
        err instanceof NotFoundException &&
        err.message === 'Spell not found'
      ) {
        return null;
      }

      throw err;
    });

    if (
      spellFromItems &&
      spellFromItems.item_name.startsWith('Halloween Spell: ')
    ) {
      return spellFromItems;
    }

    throw new NotFoundException('Spell not found');
  }

  private async getSpellByIdFromAttributes(id: string): Promise<Spell> {
    const currentKey = await this.getCurrentKeyAndError();

    const spell = await this.redis.hgetBuffer(
      this.getSuffixedKey(SPELLS_ID_KEY, currentKey),
      id,
    );

    if (!spell) {
      throw new NotFoundException('Spell not found');
    }

    return unpack(spell);
  }

  async getSpellByName(name: string): Promise<Spell> {
    const spellFromAttributes = await this.getSpellByNameFromAttributes(
      name,
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

  private async getSpellByNameFromAttributes(name: string): Promise<Spell> {
    const currentKey = await this.getCurrentKeyAndError();

    const spell = await this.redis.hgetBuffer(
      this.getSuffixedKey(SPELLS_NAME_KEY, currentKey),
      Buffer.from(name).toString('base64'),
    );

    if (!spell) {
      throw new NotFoundException('Spell not found');
    }

    return unpack(spell);
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

  async createJobsIfNewUrl(url: string): Promise<void> {
    if (await this.isSameItemsGameUrl(url)) {
      return;
    }

    await this.createJobs();
  }

  async createJobs(check = false, force = false): Promise<boolean> {
    if (!force && !check) {
      // Check if the schema was recently queued to be checked
      const last = await this.redis.get(LAST_CHECKED_KEY);
      if (last) {
        // It has been checked earlier
        const time = parseInt(last, 10);
        if (Date.now() - time < this.updateTimeout) {
          return false;
        }

        // Check happened a while ago, we will check again
      }
    }

    const time = Date.now();

    await this.redis.set(LAST_CHECKED_KEY, time);

    await this.createSchemaJob(time, force);

    return true;
  }

  private async getItemsGameUrl(): Promise<string | null> {
    const currentKey = await this.getCurrentKey();

    return this.redis.get(this.getSuffixedKey(ITEMS_GAME_URL_KEY, currentKey));
  }

  private async isSameItemsGameUrl(url: string): Promise<boolean> {
    const currentItemsGameUrl = await this.getItemsGameUrl();
    return currentItemsGameUrl === url;
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
  async updateSchema(job: Job) {
    const currentKey = await this.getCurrentKey();
    if (currentKey) {
      // We have a schema stored, check if the schema is newer than this one
      const currentTime = parseInt(currentKey, 10);
      if (currentTime > job.data.time) {
        // The schema has already been updated
        this.logger.debug('Schema has been updated more recently');
        return;
      }
    }

    await this.redis
      .multi()
      .set(LAST_UPDATED_KEY, job.data.time)
      .set(CURRENT_SCHEMA_KEY, job.data.time)
      .exec();

    // Delete schema keys with the old suffix
    await this.deleteKeysByPattern(
      // TODO: Fix this. Very dangerous, could delete all keys
      // We use "schema:*:*" to make sure that we do not get the current schema
      // or last updated keys. They would only match the pattern "schema:*".
      'schema:*:*',
      job.data.time.toString(),
    );

    const metadata = await this.getSchema();

    await this.eventsService.publish(
      SCHEMA_EVENT,
      metadata satisfies SchemaEvent['data'],
    );

    this.logger.log('Schema updated');
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

    await this.redis.set(
      this.getSuffixedKey(ITEMS_GAME_URL_KEY, job.data.time),
      url,
    );

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
      .hmset(
        this.getSuffixedKey(SCHEMA_QUALITIES_NAME_KEY, time),
        qualitiesByName,
      )
      .hmset(this.getSuffixedKey(SCHEMA_QUALITIES_ID_KEY, time), qualitiesById)
      .hmset(this.getSuffixedKey(SCHEMA_EFFECTS_NAME_KEY, time), effectsByName)
      .hmset(this.getSuffixedKey(SCHEMA_EFFECTS_ID_KEY, time), effectsById)
      .hmset(this.getSuffixedKey(SPELLS_NAME_KEY, time), spellsByName)
      .hmset(this.getSuffixedKey(SPELLS_ID_KEY, time), spellsById)
      .exec();
  }

  async updateItems(job: Job, result: GetSchemaItemsResponse) {
    if (result.next) {
      // There are more items to fetch
      await this.createItemsJob(job, result.next);
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
      .hmset(this.getSuffixedKey(PAINTKIT_ID_KEY, job.data.time), paintkitsById)
      .hmset(
        this.getSuffixedKey(PAINTKIT_NAME_KEY, job.data.time),
        paintkitsByName,
      )
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
      OVERVIEW_FILE,
      pack(result).toString('base64'),
    );
  }

  async getSchemaOverview(): Promise<SchemaOverviewResponse> {
    const overview = await this.storageService.read(OVERVIEW_FILE);
    if (!overview) {
      throw new NotFoundException('Schema overview not found');
    }

    return unpack(Buffer.from(overview, 'base64'));
  }

  private async saveSchemaItemsGameFile(
    result: string,
    time: number,
  ): Promise<void> {
    await this.storageService.write(ITEMS_GAME_FILE, result);
  }

  async getSchemaItemsGame(): Promise<string> {
    const items = await this.storageService.read(ITEMS_GAME_FILE);
    if (!items) {
      throw new NotFoundException('Schema items not found');
    }

    return items;
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
