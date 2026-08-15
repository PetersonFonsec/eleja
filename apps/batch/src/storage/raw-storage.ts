import type { Readable } from 'node:stream';

export interface RawStoragePutResult {
  stored: boolean;
}

export interface RawStoragePutOptions {
  contentLength?: number;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface RawStorage {
  exists(key: string): Promise<boolean>;
  get(key: string): Promise<Readable>;
  put(
    key: string,
    content: Readable,
    options?: RawStoragePutOptions,
  ): Promise<RawStoragePutResult>;
}
