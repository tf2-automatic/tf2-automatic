export interface StorageEngine {
  read(relativePath: string): Promise<string | null>;
  write(relativePath: string, data: string): Promise<boolean>;
}
