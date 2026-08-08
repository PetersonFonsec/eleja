import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CandidateAssetDatasetExtractor } from '../src/extraction/candidate-asset-dataset-extractor.js';
import { TseCandidateAssetDatasetSource } from '../src/sources/tse/tse-candidate-asset-dataset-source.js';
import { FileSystemRawStorage } from '../src/storage/file-system-raw-storage.js';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('CandidateAssetDatasetExtractor', () => {
  it('preserves official bytes and reuses a checksum-addressed RAW key', async () => {
    const root = await mkdtemp(join(tmpdir(), 'eleja-assets-extractor-'));
    directories.push(root);
    const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff]);
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const request = vi.fn(
      async () =>
        new Response(bytes, {
          status: 200,
          headers: { 'content-type': 'application/zip' },
        }),
    );
    const extractor = new CandidateAssetDatasetExtractor(
      new TseCandidateAssetDatasetSource(request as typeof fetch),
      new FileSystemRawStorage(root),
    );

    const first = await extractor.extract(2026);
    const second = await extractor.extract(2026);
    const key = `tse/2026/assets/${checksum}/bem_candidato_2026.zip`;
    expect(first).toMatchObject({
      dataset: 'CANDIDATE_ASSETS',
      checksum,
      storageKey: key,
      stored: true,
      size: bytes.length,
    });
    expect(second).toMatchObject({ storageKey: key, stored: false });
    await expect(readFile(join(root, key))).resolves.toEqual(bytes);
  });
});
