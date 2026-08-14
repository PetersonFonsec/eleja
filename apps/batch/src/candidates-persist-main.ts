import { CandidateSourceType, initializeDatabase } from '@eleja/database';
import {
  openLocalCandidateRawArtifact,
  readCandidateArtifactArguments,
} from './local-candidate-raw-artifact.js';
import type { NormalizedCandidateData } from './normalization/normalized-candidate-data.js';
import { TseCandidateNormalizer } from './normalization/tse-candidate-normalizer.js';
import { CandidatePersistenceService } from './persistence/candidate-persistence.js';
import type { CandidateImportContext } from './persistence/candidate-import-context.js';
import { TseCandidateDatasetSource } from './sources/tse/tse-candidate-dataset-source.js';
import { TseCandidateDatasetParser } from './sources/tse/tse-candidate-parser.js';

interface PersistenceStatistics {
  normalized: number;
  inserted: number;
  updated: number;
  unchanged: number;
  parserRejected: number;
  normalizerRejected: number;
  persistenceRejected: number;
  electionsCreated: number;
  partiesCreated: number;
  officesCreated: number;
  peopleCreated: number;
  sourcesInserted: number;
  sourcesUpdated: number;
  sourcesUnchanged: number;
  matchedByStableIdentifier: number;
  matchedByStrongComposite: number;
  ambiguousMatches: number;
  persistenceRejectionsByReason: Record<string, number>;
}

async function main(): Promise<void> {
  const batchSize = readBatchSize();
  const artifact = await openLocalCandidateRawArtifact(
    readCandidateArtifactArguments(process.argv.slice(2)),
  );
  const orm = await initializeDatabase();
  const startedAt = performance.now();

  try {
    const parser = new TseCandidateDatasetParser();
    const normalizer = new TseCandidateNormalizer();
    const persistence = new CandidatePersistenceService(orm);
    const context: CandidateImportContext = {
      sourceType: CandidateSourceType.TSE,
      sourceName: 'Tribunal Superior Eleitoral',
      sourceUrl: new TseCandidateDatasetSource().resolve(artifact.electionYear)
        .sourceUrl,
      rawStorageKey: artifact.storageKey,
      rawChecksum: artifact.checksum,
      importedAt: new Date(),
    };
    const iterator = parser.parse(artifact.content, artifact.electionYear);
    const buffer: NormalizedCandidateData[] = [];
    const statistics: PersistenceStatistics = {
      normalized: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      parserRejected: 0,
      normalizerRejected: 0,
      persistenceRejected: 0,
      electionsCreated: 0,
      partiesCreated: 0,
      officesCreated: 0,
      peopleCreated: 0,
      sourcesInserted: 0,
      sourcesUpdated: 0,
      sourcesUnchanged: 0,
      matchedByStableIdentifier: 0,
      matchedByStrongComposite: 0,
      ambiguousMatches: 0,
      persistenceRejectionsByReason: {},
    };

    console.log('TSE candidate persistence started');
    console.log(`Artifact: ${artifact.storageKey}`);
    console.log(`Batch size: ${batchSize}`);

    let next = await iterator.next();
    while (!next.done) {
      if (next.value.status === 'REJECTED') {
        statistics.parserRejected += 1;
      } else {
        const normalized = normalizer.normalize(next.value.record);
        if (normalized.status === 'REJECTED') {
          statistics.normalizerRejected += 1;
        } else {
          statistics.normalized += 1;
          buffer.push(normalized.data);
          if (buffer.length >= batchSize) {
            await persistBuffer(buffer, persistence, context, statistics);
          }
        }
      }
      next = await iterator.next();
    }
    await persistBuffer(buffer, persistence, context, statistics);
    const parseStatistics = next.value;
    const durationSeconds = (performance.now() - startedAt) / 1000;
    const persisted =
      statistics.inserted + statistics.updated + statistics.unchanged;

    console.log('TSE candidate persistence completed');
    console.log(`Parsed: ${parseStatistics.recordsParsed}`);
    console.log(`Normalized: ${statistics.normalized}`);
    console.log(`Inserted: ${statistics.inserted}`);
    console.log(`Updated: ${statistics.updated}`);
    console.log(`Unchanged: ${statistics.unchanged}`);
    console.log(`Parser rejected: ${statistics.parserRejected}`);
    console.log(`Normalizer rejected: ${statistics.normalizerRejected}`);
    console.log(`Persistence rejected: ${statistics.persistenceRejected}`);
    console.log(`Elections created: ${statistics.electionsCreated}`);
    console.log(`Parties created: ${statistics.partiesCreated}`);
    console.log(`Offices created: ${statistics.officesCreated}`);
    console.log(`People created: ${statistics.peopleCreated}`);
    console.log(
      `Matched by stable identifier: ${statistics.matchedByStableIdentifier}`,
    );
    console.log(
      `Matched by strong composite: ${statistics.matchedByStrongComposite}`,
    );
    console.log(`Ambiguous matches: ${statistics.ambiguousMatches}`);
    console.log(
      `Persistence rejections: ${JSON.stringify(statistics.persistenceRejectionsByReason)}`,
    );
    console.log(`Sources inserted: ${statistics.sourcesInserted}`);
    console.log(`Sources updated: ${statistics.sourcesUpdated}`);
    console.log(`Sources unchanged: ${statistics.sourcesUnchanged}`);
    console.log(`Duration: ${durationSeconds.toFixed(2)}s`);
    console.log(
      `Throughput: ${durationSeconds > 0 ? (persisted / durationSeconds).toFixed(1) : '0'} candidates/s`,
    );
  } finally {
    await orm.close();
  }
}

async function persistBuffer(
  buffer: NormalizedCandidateData[],
  persistence: CandidatePersistenceService,
  context: CandidateImportContext,
  statistics: PersistenceStatistics,
): Promise<void> {
  for (const data of buffer) {
    const result = await persistence.persist(data, context);
    if (result.status === 'REJECTED') {
      statistics.persistenceRejected += 1;
      statistics.persistenceRejectionsByReason[result.issue.reason] =
        (statistics.persistenceRejectionsByReason[result.issue.reason] ?? 0) +
        1;
      if (result.issue.reason.includes('ambiguous'))
        statistics.ambiguousMatches += 1;
      continue;
    }
    if (result.status === 'INSERTED') statistics.inserted += 1;
    if (result.status === 'UPDATED') statistics.updated += 1;
    if (result.status === 'UNCHANGED') statistics.unchanged += 1;
    statistics.electionsCreated += Number(result.created.election);
    statistics.partiesCreated += Number(result.created.party);
    statistics.officesCreated += Number(result.created.office);
    statistics.peopleCreated += Number(result.created.person);
    if (result.identityMatchMethod === 'EXACT_EXTERNAL_IDENTIFIER')
      statistics.matchedByStableIdentifier += 1;
    if (result.identityMatchMethod === 'STRONG_COMPOSITE')
      statistics.matchedByStrongComposite += 1;
    if (result.sourceStatus === 'INSERTED') statistics.sourcesInserted += 1;
    if (result.sourceStatus === 'UPDATED') statistics.sourcesUpdated += 1;
    if (result.sourceStatus === 'UNCHANGED') statistics.sourcesUnchanged += 1;
  }
  buffer.length = 0;
}

function readBatchSize(): number {
  const value = Number(process.env.CANDIDATE_PERSIST_BATCH_SIZE ?? 500);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('CANDIDATE_PERSIST_BATCH_SIZE must be a positive integer');
  }
  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
