import { Logger } from '@nestjs/common';
import { S3StorageConfig } from '../../common/config/configuration';
import { StorageEngine } from './engine.interface';
import * as Minio from 'minio';
import path from 'path';

export class S3StorageEngine implements StorageEngine {
  private readonly logger = new Logger(S3StorageEngine.name);

  private readonly client = new Minio.Client({
    endPoint: this.config.endpoint,
    port: this.config.port,
    useSSL: this.config.useSSL,
    accessKey: this.config.accessKeyId,
    secretKey: this.config.secretAccessKey,
  });

  constructor(private readonly config: S3StorageConfig) {}

  setup() {
    return this.client.bucketExists(this.config.bucket).then((exists) => {
      if (!exists) {
        throw new Error(`Bucket "${this.config.bucket}" does not exist`);
      }
    });
  }

  async read(relativePath: string): Promise<string | null> {
    const fullPath = this.getFullPath(relativePath);

    const streamOrNothing = await this.client
      .getObject(this.config.bucket, fullPath)
      .catch((err) => {
        if (err.message === 'The specified key does not exist.') {
          return null;
        }
        throw err;
      });

    if (streamOrNothing === null) {
      return null;
    }

    return new Promise((resolve, reject) => {
      let data = '';
      streamOrNothing.on('data', (chunk) => {
        data += chunk;
      });
      streamOrNothing.on('end', () => {
        resolve(data);
      });
      streamOrNothing.on('error', (err) => {
        reject(err);
      });
    });
  }

  async write(relativePath: string, data: string): Promise<boolean> {
    const fullPath = this.getFullPath(relativePath);

    await this.client.putObject(
      this.config.bucket,
      fullPath,
      data,
      data.length
    );

    return true;
  }

  private getFullPath(relativePath: string): string {
    return path.join(this.config.directory, relativePath).replace(/\\/g, '/');
  }
}
