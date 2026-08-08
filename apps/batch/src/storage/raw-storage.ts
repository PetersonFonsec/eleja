import type { Readable } from 'node:stream';

export interface RawStoragePutResult {
  stored: boolean;
}

export interface RawStorage {
  exists(key: string): Promise<boolean>;
  get(key: string): Promise<Readable>;
  put(key: string, content: Readable): Promise<RawStoragePutResult>;
}
