import type { RawStorage } from '../storage/raw-storage.js';
import { TseCandidateAssetDatasetSource } from '../sources/tse/tse-candidate-asset-dataset-source.js';
import { storeRawDataset } from './raw-dataset-extractor.js';

export class CandidateAssetDatasetExtractor {
  constructor(
    private readonly source: TseCandidateAssetDatasetSource,
    private readonly storage: RawStorage,
  ) {}

  async extract(electionYear: number) {
    const download = await this.source.download(electionYear);
    const result = await storeRawDataset(
      download,
      this.storage,
      ['tse', String(electionYear), 'assets'],
      'eleja-assets-',
    );
    return {
      source: 'TSE' as const,
      dataset: 'CANDIDATE_ASSETS' as const,
      electionYear,
      originalFileName: download.originalFileName,
      contentType: download.contentType,
      sourceUrl: download.sourceUrl,
      extractedAt: new Date(),
      ...result,
    };
  }
}
