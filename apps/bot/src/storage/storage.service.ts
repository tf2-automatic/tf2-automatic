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

@Injectable()
export class StorageService implements OnApplicationShutdown {
  private readonly logger = new Logger(StorageService.name);

  private readonly dataDir: string | null = null;

  private readonly _readPromises: Map<string, Promise<ReadFileResult>> =
    new Map();
  private readonly writeQueue: queueAsPromised<WriteTask> = fastq.promise(
    this.processWriteQueue.bind(this),
    1
  );

  constructor(private readonly configService: ConfigService<Config>) {
    this.dataDir = this.configService.get<string>('dataDir') ?? null;
  }

  onApplicationShutdown() {
    // Wait for all writes to finish
    return this.writeQueue.drained();
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
    // TODO: Overwrite attempts to writes to the same file to prevent unnessesary writes
    return this.writeQueue.push({ relativePath, data });
  }
}
