import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import fastq from 'fastq';
import type { queueAsPromised } from 'fastq';
import { StorageEngine } from './engines/engine.interface';
import { MODULE_OPTIONS_TOKEN } from './nestjs-storage.module-definition';
import { StorageModuleOptions } from './nestjs-storage.module';
import { LocalStorageEngine } from './engines/local-storage.engine';
import { S3StorageEngine } from './engines/s3-storage.engine';

type ReadFileResult = string | null;
type WriteFileResult = boolean;

interface WriteTask {
  relativePath: string;
  data: string;
}

interface NextWrite {
  // The next data to write
  data: string;
  // The promise for the next write
  promise: Promise<WriteFileResult>;
}

@Injectable()
export class NestStorageService implements OnApplicationShutdown, OnModuleInit {
  private readonly logger = new Logger(NestStorageService.name);

  private readonly _readPromises: Map<string, Promise<ReadFileResult>> =
    new Map();
  private readonly currentWrites = new Map<string, Promise<WriteFileResult>>();
  private readonly nextWrites = new Map<string, NextWrite>();

  private readonly writeQueue: queueAsPromised<WriteTask, WriteFileResult> =
    fastq.promise(this.processWriteQueue.bind(this), 1);

  private readonly engine: StorageEngine;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: StorageModuleOptions,
  ) {
    if (this.options.type === 'local') {
      this.engine = new LocalStorageEngine(this.options);
    } else if (this.options.type === 's3') {
      this.engine = new S3StorageEngine(this.options);
    } else {
      throw new Error(`Unsupported storage engine type`);
    }
  }

  onModuleInit() {
    return this.engine.setup();
  }

  onApplicationShutdown() {
    // Wait for all writes to finish
    return Promise.all(
      Array.from(this.nextWrites.values()).map((write) => write.promise),
    )
      .then(() => {
        return Promise.all(this.currentWrites.values());
      })
      .then(() => {
        return this.writeQueue.drain();
      });
  }

  async read(relativePath: string): Promise<ReadFileResult> {
    if (this._readPromises.has(relativePath)) {
      // Return cached promise
      return this._readPromises.get(relativePath) as Promise<ReadFileResult>;
    }

    this.logger.debug(`Reading file "${relativePath}"`);

    const promise = this.engine.read(relativePath).catch((err) => {
      this.logger.error(
        `Failed to read file "${relativePath}": ${err.message}`,
      );
      throw err;
    });

    // Cache promise
    this._readPromises.set(relativePath, promise);

    promise.finally(() => {
      // Remove promise from cache when it's done
      this._readPromises.delete(relativePath);
    });

    return promise;
  }

  private async processWriteQueue(task: WriteTask): Promise<WriteFileResult> {
    this.logger.debug(`Writing to file "${task.relativePath}"`);

    return this.engine.write(task.relativePath, task.data).catch((err) => {
      this.logger.error(
        `Failed to write to file "${task.relativePath}": ${err.message}`,
      );
      throw err;
    });
  }

  async write(relativePath: string, data: string): Promise<WriteFileResult> {
    const currentWrite = this.currentWrites.get(relativePath);
    if (currentWrite) {
      // We are already writing to this file so queue the next write
      const nextWrite = this.nextWrites.get(relativePath);

      if (nextWrite) {
        // Have already queued the next write so just set new data and return the promise
        nextWrite.data = data;
        return nextWrite.promise;
      } else {
        // Queue the next write to start after the current write
        const promise = currentWrite.finally(() => {
          const nextWrite = this.nextWrites.get(relativePath) as NextWrite;

          const promise = this.writeQueue
            .push({
              relativePath,
              data: nextWrite.data,
            })
            .finally(() => {
              // Remove current write from map if next write is not queued
              if (!this.nextWrites.has(relativePath)) {
                this.currentWrites.delete(relativePath);
              }
            });

          // This job is now the current write
          this.currentWrites.set(relativePath, promise);
          this.nextWrites.delete(relativePath);

          return promise;
        });

        const nextWrite: NextWrite = {
          data,
          promise,
        };

        this.nextWrites.set(relativePath, nextWrite);

        return nextWrite.promise;
      }
    }

    // No writes to this file are currently in progress
    const promise = this.writeQueue.push({ relativePath, data }).finally(() => {
      // Remove current write from map if next write is not queued
      if (!this.nextWrites.has(relativePath)) {
        this.currentWrites.delete(relativePath);
      }
    });

    // This job is now the current write
    this.currentWrites.set(relativePath, promise);

    return promise;
  }
}
