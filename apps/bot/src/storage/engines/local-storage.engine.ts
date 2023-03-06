import fs from 'fs';
import path from 'path';
import writeFileAtomic from 'write-file-atomic';
import { LocalStorageConfig } from '../../common/config/configuration';
import { StorageEngine } from './engine.interface';

export class LocalStorageEngine implements StorageEngine {
  constructor(private readonly config: LocalStorageConfig) {}

  setup() {
    this.createDirectoryIfNotExists(this.config.directory);

    return Promise.resolve();
  }

  read(relativePath: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      if (!this.config.directory) {
        return resolve(null);
      }

      const fullPath = path.join(this.config.directory, relativePath);

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

  write(relativePath: string, data: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.config.directory) {
        return resolve(false);
      }

      const fullPath = path.join(this.config.directory, relativePath);

      // Create directory if it doesn't exist
      this.createDirectoryIfNotExists(path.dirname(fullPath));

      // Write to file
      writeFileAtomic(fullPath, data, (err) => {
        if (err) {
          return reject(err);
        }

        resolve(true);
      });
    });
  }

  private createDirectoryIfNotExists(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
