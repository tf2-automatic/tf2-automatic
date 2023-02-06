import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '../common/config/configuration';
import fs from 'fs';
import path from 'path';
import writeFileAtomic from 'write-file-atomic';

type ReadFileResult = string | null;
type WriteFileResult = boolean;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  private readonly dataDir: string | null = null;

  private readonly _readPromises: Map<string, Promise<ReadFileResult>> =
    new Map();

  constructor(private readonly configService: ConfigService<Config>) {
    this.dataDir = this.configService.get<string>('dataDir') ?? null;
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

  async write(relativePath: string, data: string): Promise<WriteFileResult> {
    if (!this.dataDir) {
      return false;
    }

    const fullPath = path.join(this.dataDir, relativePath);

    // Create directory if it doesn't exist
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.logger.debug(`Writing file to "${fullPath}"`);

    // Write to file
    return writeFileAtomic(fullPath, data)
      .then(() => {
        return true;
      })
      .catch((err) => {
        this.logger.warn(`Error writing file "${fullPath}": ${err.message}`);
        throw err;
      });
  }
}
