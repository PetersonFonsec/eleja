import type { Readable } from 'node:stream';

export interface PublishedObject {
  key: string;
  size: number;
  metadata: Record<string, string>;
}

export interface DatasetPublisherPutInput {
  key: string;
  body: Readable | Uint8Array;
  size: number;
  contentType: string;
  contentDisposition?: string;
  cacheControl: string;
  metadata: Record<string, string>;
  immutable: boolean;
}

export interface DatasetPublisher {
  inspect(key: string): Promise<PublishedObject | null>;
  put(input: DatasetPublisherPutInput): Promise<void>;
  publicUrl(key: string): string;
}
