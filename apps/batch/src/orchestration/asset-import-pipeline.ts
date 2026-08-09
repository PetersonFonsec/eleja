import { CandidateSourceType, type initializeDatabase } from '@eleja/database';
import { CandidateAssetDatasetExtractor } from '../extraction/candidate-asset-dataset-extractor.js';
import { TseCandidateAssetNormalizer } from '../normalization/tse-candidate-asset-normalizer.js';
import { CandidateAssetPersistenceService } from '../persistence/candidate-asset-persistence.js';
import { TseCandidateAssetDatasetSource } from '../sources/tse/tse-candidate-asset-dataset-source.js';
import { TseCandidateAssetDatasetParser } from '../sources/tse/tse-candidate-asset-parser.js';
import { FileSystemRawStorage } from '../storage/file-system-raw-storage.js';
import type {
  AssetPipelineStatistics,
  ElectoralPipelineStage,
} from './pipeline-types.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;

export class AssetImportPipeline {
  constructor(
    private readonly orm: Database,
    private readonly rawStorageRoot: string,
    private readonly timeoutMs: number,
  ) {}

  async execute(
    year: number,
    stage: (stage: ElectoralPipelineStage) => void,
  ): Promise<AssetPipelineStatistics> {
    const storage = new FileSystemRawStorage(this.rawStorageRoot);
    const source = new TseCandidateAssetDatasetSource(fetch, this.timeoutMs);
    stage('EXTRACT_ASSETS');
    const artifact = await new CandidateAssetDatasetExtractor(
      source,
      storage,
    ).extract(year);
    const content = await storage.get(artifact.storageKey);
    const parser = new TseCandidateAssetDatasetParser();
    const normalizer = new TseCandidateAssetNormalizer();
    const persistence = new CandidateAssetPersistenceService(this.orm);
    const statistics: AssetPipelineStatistics = {
      recordsRead: 0,
      parserRejected: 0,
      normalized: 0,
      normalizationRejected: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      candidacyNotFound: 0,
    };
    stage('PARSE_ASSETS');
    stage('NORMALIZE_ASSETS');
    stage('PERSIST_ASSETS');
    const iterator = parser.parse(content, year);
    let next = await iterator.next();
    while (!next.done) {
      if (next.value.status === 'REJECTED') statistics.parserRejected += 1;
      else {
        const normalized = normalizer.normalize(next.value.record);
        if (normalized.status === 'REJECTED') {
          statistics.normalizationRejected += 1;
        } else {
          statistics.normalized += 1;
          const result = await persistence.persist(normalized.data, {
            sourceType: CandidateSourceType.TSE,
            sourceName: 'Tribunal Superior Eleitoral',
            sourceUrl: artifact.sourceUrl,
            rawStorageKey: artifact.storageKey,
            rawChecksum: artifact.checksum,
            importedAt: artifact.extractedAt,
          });
          if (result.status === 'REJECTED') statistics.candidacyNotFound += 1;
          else if (result.status === 'INSERTED') statistics.inserted += 1;
          else if (result.status === 'UPDATED') statistics.updated += 1;
          else statistics.unchanged += 1;
        }
      }
      next = await iterator.next();
    }
    statistics.recordsRead = next.value.recordsRead;
    return statistics;
  }
}
