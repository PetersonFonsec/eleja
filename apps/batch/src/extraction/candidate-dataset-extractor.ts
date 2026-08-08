import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { RawStorage } from '../storage/raw-storage.js';
import type { CandidateDatasetSource } from '../sources/tse/tse-candidate-dataset-source.js';

export interface CandidateExtractionResult {
  source: 'TSE';
  dataset: 'CANDIDATES';
  electionYear: number;
  originalFileName: string;
  contentType: string;
  size: number;
  checksum: string;
  sourceUrl: string;
  extractedAt: Date;
  storageKey: string;
  stored: boolean;
}

export class CandidateDatasetExtractor {
  constructor(
    private readonly source: CandidateDatasetSource,
    private readonly storage: RawStorage,
  ) {}

  async extract(electionYear: number): Promise<CandidateExtractionResult> {
    const download = await this.source.download(electionYear);
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), 'eleja-candidates-'),
    );
    const temporaryFile = join(temporaryDirectory, download.originalFileName);
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
        createWriteStream(temporaryFile, { flags: 'wx' }),
      );

      const checksum = hash.digest('hex');
      const storageKey = [
        'tse',
        String(electionYear),
        'candidates',
        checksum,
        download.originalFileName,
      ].join('/');

      const alreadyExists = await this.storage.exists(storageKey);
      const putResult = alreadyExists
        ? { stored: false }
        : await this.storage.put(storageKey, createReadStream(temporaryFile));

      return {
        source: 'TSE',
        dataset: 'CANDIDATES',
        electionYear,
        originalFileName: download.originalFileName,
        contentType: download.contentType,
        size,
        checksum,
        sourceUrl: download.sourceUrl,
        extractedAt: new Date(),
        storageKey,
        stored: putResult.stored,
      };
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}
