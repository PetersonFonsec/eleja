import { createHash } from 'node:crypto';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { CandidateDatasetExtractor } from '../src/extraction/candidate-dataset-extractor.js';
import type { CandidateDatasetSource } from '../src/sources/tse/tse-candidate-dataset-source.js';
import { FileSystemRawStorage } from '../src/storage/file-system-raw-storage.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('CandidateDatasetExtractor', () => {
  it('preserves bytes, calculates metadata and is idempotent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'eleja-extractor-test-'));
    temporaryDirectories.push(root);
    const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff]);
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const source: CandidateDatasetSource = {
      resolve: (electionYear) => ({
        electionYear,
        originalFileName: `consulta_cand_${electionYear}.zip`,
        sourceUrl: `https://example.test/consulta_cand_${electionYear}.zip`,
      }),
      download: async (electionYear) => ({
        electionYear,
        originalFileName: `consulta_cand_${electionYear}.zip`,
        sourceUrl: `https://example.test/consulta_cand_${electionYear}.zip`,
        contentType: 'application/zip',
        content: Readable.from(bytes),
      }),
    };
    const extractor = new CandidateDatasetExtractor(
      source,
      new FileSystemRawStorage(root),
    );

    const first = await extractor.extract(2026);
    const second = await extractor.extract(2026);
    const expectedKey = `tse/2026/candidates/${checksum}/consulta_cand_2026.zip`;

    expect(first).toMatchObject({
      source: 'TSE',
      dataset: 'CANDIDATES',
      electionYear: 2026,
      size: bytes.length,
      checksum,
      storageKey: expectedKey,
      stored: true,
    });
    expect(first.extractedAt).toBeInstanceOf(Date);
    expect(second).toMatchObject({ storageKey: expectedKey, stored: false });
    await expect(readFile(join(root, expectedKey))).resolves.toEqual(bytes);
  });
});
