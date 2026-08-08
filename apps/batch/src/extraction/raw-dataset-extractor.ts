import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { RawStorage } from '../storage/raw-storage.js';

export interface RawDatasetDownload {
  originalFileName: string;
  sourceUrl: string;
  contentType: string;
  content: Readable;
}

export async function storeRawDataset(
  download: RawDatasetDownload,
  storage: RawStorage,
  keyPrefix: string[],
  temporaryPrefix: string,
) {
  const directory = await mkdtemp(join(tmpdir(), temporaryPrefix));
  const file = join(directory, download.originalFileName);
  const hash = createHash('sha256');
  let size = 0;
  const checksumStream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      size += chunk.length;
      callback(null, chunk);
    },
  });
  try {
    await pipeline(
      download.content,
      checksumStream,
      createWriteStream(file, { flags: 'wx' }),
    );
    const checksum = hash.digest('hex');
    const storageKey = [...keyPrefix, checksum, download.originalFileName].join(
      '/',
    );
    const alreadyExists = await storage.exists(storageKey);
    const result = alreadyExists
      ? { stored: false }
      : await storage.put(storageKey, createReadStream(file));
    return { checksum, storageKey, size, stored: result.stored };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
