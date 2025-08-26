export interface StorageEngine {
  setup(): Promise<void>;
  read(relativePath: string): Promise<string | null>;
  write(relativePath: string, data: string): Promise<boolean>;
  delete(relativePath: string): Promise<boolean>;
  exists(relativePath: string): Promise<boolean>;
}
