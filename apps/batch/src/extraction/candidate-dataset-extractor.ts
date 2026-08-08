import type { RawStorage } from '../storage/raw-storage.js';
import type { CandidateDatasetSource } from '../sources/tse/tse-candidate-dataset-source.js';
import { storeRawDataset } from './raw-dataset-extractor.js';

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
    const result = await storeRawDataset(
      download,
      this.storage,
      ['tse', String(electionYear), 'candidates'],
      'eleja-candidates-',
    );
    return {
      source: 'TSE',
      dataset: 'CANDIDATES',
      electionYear,
      originalFileName: download.originalFileName,
      contentType: download.contentType,
      size: result.size,
      checksum: result.checksum,
      sourceUrl: download.sourceUrl,
      extractedAt: new Date(),
      storageKey: result.storageKey,
      stored: result.stored,
    };
  }
}
