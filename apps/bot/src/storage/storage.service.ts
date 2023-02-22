import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config, StorageConfig } from '../common/config/configuration';
import fastq from 'fastq';
import type { queueAsPromised } from 'fastq';
import { StorageEngine } from './engines/engine.interface';
import { LocalStorageEngine } from './engines/local-storage.engine';

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
export class StorageService implements OnApplicationShutdown, OnModuleInit {
  private readonly _readPromises: Map<string, Promise<ReadFileResult>> =
    new Map();
  private readonly currentWrites = new Map<string, Promise<WriteFileResult>>();
  private readonly nextWrites = new Map<string, NextWrite>();

  private readonly writeQueue: queueAsPromised<WriteTask, WriteFileResult> =
    fastq.promise(this.processWriteQueue.bind(this), 1);

  private engine: StorageEngine;

  constructor(private readonly configService: ConfigService<Config>) {
    const storageConfig =
      this.configService.getOrThrow<StorageConfig>('storage');

    if (storageConfig.type === 'local') {
      this.engine = new LocalStorageEngine(storageConfig);
    } else {
      throw new Error('Invalid storage type: ' + storageConfig);
    }
  }

  onModuleInit() {
    return this.engine.setup();
  }

  onApplicationShutdown() {
    // Wait for all writes to finish
    return Promise.all(
      Array.from(this.nextWrites.values()).map((write) => write.promise)
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

    const promise = this.engine.read(relativePath);

    // Cache promise
    this._readPromises.set(relativePath, promise);

    promise.finally(() => {
      // Remove promise from cache when it's done
      this._readPromises.delete(relativePath);
    });

    return promise;
  }

  private async processWriteQueue(task: WriteTask): Promise<WriteFileResult> {
    return this.engine.write(task.relativePath, task.data);
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
