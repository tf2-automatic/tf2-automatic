import {
  BadRequestException,
  Injectable,
  OnApplicationShutdown,
} from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import TeamFortress2 from 'tf2';
import TF2Language from 'tf2/language';
import { Logger } from '@nestjs/common';
import {
  CraftResult,
  SortBackpackTypes,
  TF2Account,
  TF2GainedEvent,
  TF2LostEvent,
  TF2_GAINED_EVENT,
  TF2_LOST_EVENT,
} from '@tf2-automatic/bot-data';
import fastq from 'fastq';
import type { queueAsPromised } from 'fastq';
import { EventsService } from '../events/events.service';
import { CraftDto, SortBackpackDto } from '@tf2-automatic/dto';

// Stop node-tf2 from fetching the item schema
delete TeamFortress2.prototype._handlers[TF2Language.UpdateItemSchema];

enum TaskType {
  Craft = 'CRAFT',
  Use = 'USE',
  Delete = 'DELETE',
  Sort = 'SORT',
}

type Task = CraftTask | UseTask | DeleteTask | SortTask;

type BaseTask = {
  type: TaskType;
};

type CraftTask = BaseTask & {
  type: TaskType.Craft;
  craft: CraftDto;
};

type UseTask = BaseTask & {
  type: TaskType.Use;
  assetid: string;
};

type DeleteTask = BaseTask & {
  type: TaskType.Delete;
  assetid: string;
};

type SortTask = BaseTask & {
  type: TaskType.Sort;
  sort: SortBackpackTypes;
};

class ItemNotInBackpackException extends BadRequestException {
  constructor(assetid: string) {
    super('Item is not in backpack (assetid: ' + assetid + ')');
  }
}

@Injectable()
export class TF2Service implements OnApplicationShutdown {
  private readonly logger = new Logger(TF2Service.name);

  private readonly client = this.botService.getClient();
  private readonly tf2 = new TeamFortress2(this.client);

  private readonly queue: queueAsPromised<Task> = fastq.promise(
    this.process.bind(this),
    1
  );

  private account: TF2Account | null = null;

  private reconnectTimeout: NodeJS.Timeout | null = null;
  private manuallyDisconnectedFromGC = false;

  constructor(
    private readonly botService: BotService,
    private readonly eventsService: EventsService
  ) {
    this.client.on('loggedOn', () => {
      // Bot is logged in, connect to TF2 GC
      this.client.gamesPlayed([440]);
    });

    this.tf2.on('connectedToGC', () => {
      this.logger.debug('Connected to GC');
    });

    this.tf2.on('disconnectedFromGC', () => {
      this.logger.debug('Disconnected from GC');
    });

    this.client.on('appQuit', () => {
      if (this.manuallyDisconnectedFromGC) {
        this.manuallyDisconnectedFromGC = false;

        // Add timeout to give Steam some time before we open the app again
        setTimeout(() => {
          this.client.gamesPlayed([440]);
        }, 1000);
      }
    });

    this.tf2.on('accountLoaded', () => {
      this.logger.debug('Account loaded');
      this.accountLoaded();
    });

    this.tf2.on('accountUpdate', () => {
      this.logger.debug('Account update');
      this.accountLoaded();
    });

    this.tf2.on('itemAcquired', (item) => {
      this.refreshInventory();

      this.eventsService
        .publish(TF2_GAINED_EVENT, item satisfies TF2GainedEvent['data'])
        .catch(() => {
          // Ignore error
        });
    });

    this.tf2.on('itemRemoved', (item) => {
      this.refreshInventory();

      this.eventsService
        .publish(TF2_LOST_EVENT, item satisfies TF2LostEvent['data'])
        .catch(() => {
          // Ignore error
        });
    });
  }

  private refreshInventory(): void {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.logger.debug('Reconnecting to GC to refresh inventory');
      this.manuallyDisconnectedFromGC = true;
      this.client.gamesPlayed([]);
      this.reconnectTimeout = null;
    }, 10000);
  }

  private async process(task: Task): Promise<unknown> {
    this.logger.debug('Processing task: ' + task.type);

    await this.connectToGC();
    await this.waitForBackpack();

    switch (task.type) {
      case TaskType.Craft:
        return this.processCraft(task.craft);
      case TaskType.Use:
        return this.processUseItem(task.assetid);
      case TaskType.Delete:
        return this.processDeleteItem(task.assetid);
      case TaskType.Sort:
        return this.processSortBackpack();
      default:
        // @ts-expect-error Gives compile-time error if not all task types are handled.
        throw new Error('Unknown task type: ' + task.type);
    }
  }

  craft(craft: CraftDto): Promise<CraftResult> {
    const task: CraftTask = {
      type: TaskType.Craft,
      craft,
    };
    return this.queue.push(task).then((result) => {
      return result as ReturnType<TF2Service['processCraft']>;
    });
  }

  private processCraft(craft: CraftDto): Promise<CraftResult> {
    this.logger.debug(
      'Crafting items (recipe: ' +
        craft.recipe +
        ', assetids: [' +
        craft.assetids.join(', ') +
        '])'
    );

    craft.assetids.forEach((assetid) => {
      if (!this.isItemInBackpack(assetid)) {
        throw new ItemNotInBackpackException(assetid);
      }
    });

    this.tf2.craft(craft.assetids, craft.recipe);

    return this.waitForEvent('craftingComplete').then(
      ([recipe, assetids]: [number, string[]]) => {
        this.logger.debug(
          'Crafting complete (recipe: ' +
            recipe +
            ', assetids: [' +
            assetids.join(', ') +
            '])'
        );
        return {
          recipe,
          assetids,
        };
      }
    );
  }

  useItem(assetid: string): Promise<void> {
    const task: UseTask = {
      type: TaskType.Use,
      assetid,
    };

    return this.queue.push(task).then((result) => {
      return result as ReturnType<TF2Service['processUseItem']>;
    });
  }

  private processUseItem(assetid: string): Promise<void> {
    this.logger.debug('Using item (assetid: ' + assetid + ')');

    if (!this.isItemInBackpack(assetid)) {
      throw new ItemNotInBackpackException(assetid);
    }

    this.tf2.useItem(assetid);

    return this.waitForEvent('itemRemoved', ([item]) => {
      return item.id == assetid;
    }).then(() => {
      this.logger.debug('Item used (assetid: ' + assetid + ')');
    });
  }

  deleteItem(assetid: string): Promise<void> {
    const task: DeleteTask = {
      type: TaskType.Delete,
      assetid,
    };

    return this.queue.push(task).then((result) => {
      return result as ReturnType<TF2Service['processDeleteItem']>;
    });
  }

  private processDeleteItem(assetid: string): Promise<void> {
    this.logger.debug('Deleting item (assetid: ' + assetid + ')');

    if (!this.isItemInBackpack(assetid)) {
      throw new ItemNotInBackpackException(assetid);
    }

    this.tf2.deleteItem(assetid);

    return this.waitForEvent('itemRemoved', ([item]) => {
      return item.id == assetid;
    }).then(() => {
      this.logger.debug('Item deleted (assetid: ' + assetid + ')');
    });
  }

  sortBackpack(sort: SortBackpackDto): Promise<void> {
    const task: SortTask = {
      type: TaskType.Sort,
      sort: sort.sort,
    };

    return this.queue.push(task).then((result) => {
      return result as ReturnType<TF2Service['processSortBackpack']>;
    });
  }

  private processSortBackpack(): Promise<void> {
    this.logger.debug('Sorting backpack');

    this.tf2.sortBackpack(102);

    return this.waitForNoEvent('itemChanged', 1000).then(() => {
      this.logger.debug('Backpack sorted');
    });
  }

  onApplicationShutdown(): void {
    this.client.gamesPlayed([]);
    this.tf2.removeAllListeners();
  }

  private accountLoaded(): void {
    this.account = {
      isPremium: this.tf2.premium,
      backpackSlots: this.tf2.backpackSlots,
    };
  }

  async connectToGC(): Promise<void> {
    if (!this.isPlayingTF2()) {
      // Not playing TF2
      this.client.gamesPlayed([440]);
    }

    if (this.tf2.haveGCSession) {
      // Already connected
      return;
    }

    await this.waitForEvent('connectedToGC');
  }

  isPlayingTF2(): boolean {
    // @ts-expect-error This is a private property
    return (this.client._playingAppIds as number[]).some((game) => game == 440);
  }

  private isItemInBackpack(assetid: string): boolean {
    if (this.tf2.backpack === undefined) {
      throw new Error('Backpack not loaded');
    }

    return this.tf2.backpack.some((item) => item.id === assetid);
  }

  private async waitForBackpack(): Promise<void> {
    if (this.tf2.backpack === undefined) {
      // Backpack not loaded yet
      await this.connectToGC();
      await this.waitForEvent('backpackLoaded');
    }
  }

  async getAccount(): Promise<TF2Account> {
    if (this.account == null) {
      await this.connectToGC();
      await this.waitForEvent('accountLoaded').then(() => {
        this.accountLoaded();
      });
    }

    // This is magical
    return this.account as NonNullable<typeof this.account>;
  }

  /**
   * Waits for no event to be emitted for a certain amount of time
   * @param eventName Name of the event
   * @param timeoutDuration Amount of time to wait
   * @param filter Filter events based on the arguments
   * @returns Promise that resolves when no event has been emitted for `timeoutDuration`
   * @throws Error if disconnected from GC
   */
  private waitForNoEvent(
    eventName: string,
    timeoutDuration: number,
    filter?: (...args) => boolean
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const createTimeout = () => {
        const timeout = setTimeout(() => {
          removeListeners();
          resolve();
        }, timeoutDuration);

        return timeout;
      };

      let timeout = createTimeout();

      const listener = (...args) => {
        if (filter && !filter(args)) {
          // Not the event we are looking for
          return;
        }

        clearTimeout(timeout);
        timeout = createTimeout();
      };

      const disconnectedListener = () => {
        removeListeners();
        reject(new Error('Disconnected from GC'));
      };

      const removeListeners = () => {
        clearTimeout(timeout);
        this.tf2.removeListener(eventName, listener);
        this.tf2.removeListener('disconnectedFromGC', disconnectedListener);
      };

      if (eventName !== 'disconnectedFromGC') {
        this.tf2.once('disconnectedFromGC', disconnectedListener);
      }

      this.tf2.on(eventName, listener);
    });
  }

  /**
   * Waits for an event to be emitted
   * @param eventName Name of the event
   * @param filter Filter events based on the arguments
   * @returns The arguments of the event
   * @throws Error if the event is not emitted within 10 seconds
   * @throws Error if disconnected from GC
   */
  private waitForEvent(
    eventName: string,
    filter?: (...args) => boolean
  ): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      const listener = (...args) => {
        if (filter && !filter(args)) {
          // Not the event we are looking for
          return;
        }

        removeListeners();
        resolve(args);
      };

      const disconnectedListener = () => {
        removeListeners();
        reject(new Error('Disconnected from GC'));
      };

      const removeListeners = () => {
        clearTimeout(timeout);
        this.tf2.removeListener(eventName, listener);
        this.tf2.removeListener('disconnectedFromGC', disconnectedListener);
      };

      const timeout = setTimeout(() => {
        removeListeners();
        reject(new Error('Timed out waiting for event'));
      }, 10000);

      if (eventName !== 'disconnectedFromGC') {
        this.tf2.once('disconnectedFromGC', disconnectedListener);
      }

      this.tf2.on(eventName, listener);
    });
  }
}
