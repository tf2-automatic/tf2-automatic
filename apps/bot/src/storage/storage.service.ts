import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '../common/config/configuration';
import fs from 'fs';
import path from 'path';

@Injectable()
export class StorageService {
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

      fs.readFile(fullPath, 'utf8', (err, data) => {
        if (err) {
          return reject(err);
        }

        resolve(data);
      });
    });
  }

  async write(relativePath: string, data: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.dataDir) {
        return resolve(false);
      }

      const fullPath = path.join(this.dataDir, relativePath);

      // Create directory if it doesn't exist
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write to file
      fs.writeFile(fullPath, data, (err) => {
        if (err) {
          return reject(err);
        }

        resolve(true);
      });
    });
  }
}
