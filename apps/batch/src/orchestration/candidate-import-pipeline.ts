import { CandidateSourceType, type initializeDatabase } from '@eleja/database';
import type { NormalizedCandidateData } from '../normalization/normalized-candidate-data.js';
import { TseCandidateNormalizer } from '../normalization/tse-candidate-normalizer.js';
import { CandidatePersistenceService } from '../persistence/candidate-persistence.js';
import { CandidateDatasetExtractor } from '../extraction/candidate-dataset-extractor.js';
import { TseCandidateDatasetSource } from '../sources/tse/tse-candidate-dataset-source.js';
import { TseCandidateDatasetParser } from '../sources/tse/tse-candidate-parser.js';
import { FileSystemRawStorage } from '../storage/file-system-raw-storage.js';
import type {
  CandidatePipelineStatistics,
  ElectoralPipelineStage,
} from './pipeline-types.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;

export class CandidateImportPipeline {
  constructor(
    private readonly orm: Database,
    private readonly rawStorageRoot: string,
    private readonly timeoutMs: number,
    private readonly batchSize: number,
  ) {}

  async execute(
    year: number,
    stage: (stage: ElectoralPipelineStage) => void,
  ): Promise<CandidatePipelineStatistics> {
    const storage = new FileSystemRawStorage(this.rawStorageRoot);
    const source = new TseCandidateDatasetSource(fetch, this.timeoutMs);
    stage('EXTRACT_CANDIDATES');
    const artifact = await new CandidateDatasetExtractor(
      source,
      storage,
    ).extract(year);
    const content = await storage.get(artifact.storageKey);
    const parser = new TseCandidateDatasetParser();
    const normalizer = new TseCandidateNormalizer();
    const persistence = new CandidatePersistenceService(this.orm);
    const statistics: CandidatePipelineStatistics = {
      recordsRead: 0,
      parserRejected: 0,
      normalized: 0,
      normalizationRejected: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      persistenceRejected: 0,
      matchedByStableIdentifier: 0,
      matchedByStrongComposite: 0,
      newPersonsCreated: 0,
      ambiguousMatches: 0,
    };
    stage('PARSE_CANDIDATES');
    stage('NORMALIZE_CANDIDATES');
    stage('PERSIST_CANDIDATES');
    const iterator = parser.parse(content, year);
    const buffer: NormalizedCandidateData[] = [];
    let next = await iterator.next();
    while (!next.done) {
      if (next.value.status === 'REJECTED') statistics.parserRejected += 1;
      else {
        const normalized = normalizer.normalize(next.value.record);
        if (normalized.status === 'REJECTED') {
          statistics.normalizationRejected += 1;
        } else {
          statistics.normalized += 1;
          buffer.push(normalized.data);
          if (buffer.length >= this.batchSize) {
            await persistCandidates(buffer, persistence, artifact, statistics);
          }
        }
      }
      next = await iterator.next();
    }
    statistics.recordsRead = next.value.recordsRead;
    await persistCandidates(buffer, persistence, artifact, statistics);
    return statistics;
  }
}

async function persistCandidates(
  buffer: NormalizedCandidateData[],
  persistence: CandidatePersistenceService,
  artifact: Awaited<ReturnType<CandidateDatasetExtractor['extract']>>,
  statistics: CandidatePipelineStatistics,
): Promise<void> {
  for (const data of buffer) {
    const result = await persistence.persist(data, {
      sourceType: CandidateSourceType.TSE,
      sourceName: 'Tribunal Superior Eleitoral',
      sourceUrl: artifact.sourceUrl,
      rawStorageKey: artifact.storageKey,
      rawChecksum: artifact.checksum,
      importedAt: artifact.extractedAt,
    });
    if (result.status === 'REJECTED') {
      statistics.persistenceRejected += 1;
      if (result.issue.reason.includes('ambiguous'))
        statistics.ambiguousMatches += 1;
    } else {
      if (result.status === 'INSERTED') statistics.inserted += 1;
      else if (result.status === 'UPDATED') statistics.updated += 1;
      else statistics.unchanged += 1;
      if (result.identityMatchMethod === 'EXACT_EXTERNAL_IDENTIFIER')
        statistics.matchedByStableIdentifier += 1;
      if (result.identityMatchMethod === 'STRONG_COMPOSITE')
        statistics.matchedByStrongComposite += 1;
      if (result.identityMatchMethod === 'NEW_PERSON')
        statistics.newPersonsCreated += 1;
    }
  }
  buffer.length = 0;
}
