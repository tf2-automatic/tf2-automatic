import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '../common/config/configuration';
import fs from 'fs';
import path from 'path';
import writeFileAtomic from 'write-file-atomic';
import fastq from 'fastq';
import type { queueAsPromised } from 'fastq';

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
export class StorageService implements OnApplicationShutdown {
  private readonly logger = new Logger(StorageService.name);

  private readonly dataDir: string | null = null;

  private readonly _readPromises: Map<string, Promise<ReadFileResult>> =
    new Map();
  private readonly currentWrites = new Map<string, Promise<WriteFileResult>>();
  private readonly nextWrites = new Map<string, NextWrite>();

  private readonly writeQueue: queueAsPromised<WriteTask, WriteFileResult> =
    fastq.promise(this.processWriteQueue.bind(this), 1);

  constructor(private readonly configService: ConfigService<Config>) {
    this.dataDir = this.configService.get<string>('dataDir') ?? null;
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

    const promise = new Promise<ReadFileResult>((resolve, reject) => {
      if (!this.dataDir) {
        return resolve(null);
      }

      const fullPath = path.join(this.dataDir, relativePath);

      if (!fs.existsSync(fullPath)) {
        return resolve(null);
      }

      this.logger.debug(`Reading file "${fullPath}"`);

      fs.readFile(fullPath, 'utf8', (err, data) => {
        if (err) {
          this.logger.warn(`Error reading file "${fullPath}": ${err.message}`);
          return reject(err);
        }

        resolve(data);
      });
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
    return new Promise<WriteFileResult>((resolve, reject) => {
      if (!this.dataDir) {
        return resolve(false);
      }

      const fullPath = path.join(this.dataDir, task.relativePath);

      // Create directory if it doesn't exist
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.logger.debug(`Writing file to "${fullPath}"`);

      // Write to file
      writeFileAtomic(fullPath, task.data, (err) => {
        if (err) {
          this.logger.warn(`Error writing file "${fullPath}": ${err.message}`);
          return reject(err);
        }

        resolve(true);
      });
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
