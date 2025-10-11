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
import fs from 'fs';
import path from 'path';

type ReadFileResult = string | null;
type WriteFileResult = boolean;

interface WriteTask {
  relativePath: string;
  data: string | null;
}

interface NextWrite {
  // The next data to write
  data: string | null;
  // The promise for the next write
  promise: Promise<WriteFileResult>;
}

function getAppName(): string | null {
  if (process.env['NODE_ENV'] === 'test') {
    return null;
  }

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
  );

  return packageJson.name;
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

  private readonly prefix = getAppName() ? `./${getAppName()}/` : '';

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

  getEngine(): StorageEngine {
    return this.engine;
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

  getPath(relativePath: string): string {
    return path.join(this.prefix, relativePath);
  }

  async exists(relativePath: string): Promise<boolean> {
    const path = this.getPath(relativePath);

    this.logger.debug(`Checking file "${path}"`);

    return this.engine.exists(path);
  }

  async read(relativePath: string): Promise<ReadFileResult> {
    const path = this.getPath(relativePath);

    if (this._readPromises.has(path)) {
      // Return cached promise
      return this._readPromises.get(path) as Promise<ReadFileResult>;
    }

    this.logger.debug(`Reading file "${path}"`);

    const promise = this.engine.read(path).catch((err) => {
      this.logger.error(`Failed to read file "${path}": ${err.message}`);
      throw err;
    });

    // Cache promise
    this._readPromises.set(path, promise);

    promise.finally(() => {
      // Remove promise from cache when it's done
      this._readPromises.delete(path);
    });

    return promise;
  }

  private async processWriteQueue(task: WriteTask): Promise<WriteFileResult> {
    let promise: Promise<WriteFileResult>;

    if (task.data === null) {
      this.logger.debug(`Deleting file "${task.relativePath}"`);
      promise = this.engine.delete(task.relativePath);
    } else {
      this.logger.debug(`Writing to file "${task.relativePath}"`);
      promise = this.engine.write(task.relativePath, task.data);
    }

    return promise.catch((err) => {
      this.logger.error(
        `Failed to ${task.data === null ? 'delete' : 'write to'} file "${
          task.relativePath
        }": ${err.message}`,
      );
      throw err;
    });
  }

  async write(relativePath: string, data: string): Promise<WriteFileResult> {
    const path = this.getPath(relativePath);
    return this.writeOrDelete(path, data);
  }

  async delete(relativePath: string): Promise<WriteFileResult> {
    const path = this.getPath(relativePath);
    return this.writeOrDelete(path, null);
  }

  private async writeOrDelete(
    relativePath: string,
    data: string | null,
  ): Promise<WriteFileResult> {
    const current = this.currentWrites.get(relativePath);
    if (current) {
      // We are already writing to this file so queue the next write
      const next = this.nextWrites.get(relativePath);

      if (next) {
        // Have already queued the next write so just set new data and return the promise
        next.data = data;
        return next.promise;
      }

      const promise = current.finally(() => {
        const next = this.nextWrites.get(relativePath) as NextWrite;
        const promise = this.enqueueWrite(relativePath, next.data);
        this.nextWrites.delete(relativePath);
        return promise;
      });

      this.nextWrites.set(relativePath, {
        data,
        promise,
      });

      return promise;
    }

    return this.enqueueWrite(relativePath, data);
  }

  private enqueueWrite(
    relativePath: string,
    data: string | null,
  ): Promise<WriteFileResult> {
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
