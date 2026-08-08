import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { FileSystemRawStorage } from '../src/storage/file-system-raw-storage.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function storageFixture() {
  const root = await mkdtemp(join(tmpdir(), 'eleja-raw-storage-test-'));
  temporaryDirectories.push(root);
  return { root, storage: new FileSystemRawStorage(root) };
}

describe('FileSystemRawStorage', () => {
  it('stores the exact bytes and reports their existence', async () => {
    const { root, storage } = await storageFixture();
    const key = 'tse/2026/candidates/checksum/candidates.zip';
    const bytes = Buffer.from([0x00, 0xff, 0x50, 0x4b]);

    await expect(storage.exists(key)).resolves.toBe(false);
    await expect(storage.put(key, Readable.from(bytes))).resolves.toEqual({
      stored: true,
    });
    await expect(storage.exists(key)).resolves.toBe(true);
    await expect(readFile(join(root, key))).resolves.toEqual(bytes);
    const content = await storage.get(key);
    const chunks: Buffer[] = [];
    for await (const chunk of content) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(bytes);
  });

  it('does not overwrite an existing RAW artifact', async () => {
    const { root, storage } = await storageFixture();
    const key = 'tse/2026/candidates/checksum/candidates.zip';

    await storage.put(key, Readable.from(Buffer.from('original')));
    await expect(
      storage.put(key, Readable.from(Buffer.from('replacement'))),
    ).resolves.toEqual({ stored: false });
    await expect(readFile(join(root, key), 'utf8')).resolves.toBe('original');
  });

  it('rejects keys that escape the configured root', async () => {
    const { storage } = await storageFixture();

    await expect(storage.exists('../outside.zip')).rejects.toThrow(
      'must stay inside',
    );
  });

  it('reports a missing artifact when opening RAW content', async () => {
    const { storage } = await storageFixture();

    await expect(storage.get('missing.zip')).rejects.toThrow(
      'RAW artifact not found: missing.zip',
    );
  });
});
