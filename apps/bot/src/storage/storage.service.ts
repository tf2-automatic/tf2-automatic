import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '../common/config/configuration';
import fs from 'fs';
import path from 'path';
import writeFileAtomic from 'write-file-atomic';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  private dataDir: string | null = null;

  constructor(private readonly configService: ConfigService<Config>) {
    this.dataDir = this.configService.get<string>('dataDir') ?? null;
  }

  async read(relativePath: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
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
  }

  async write(relativePath: string, data: string): Promise<boolean> {
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
