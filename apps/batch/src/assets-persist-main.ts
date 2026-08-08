import { CandidateSourceType, initializeDatabase } from '@eleja/database';
import { openLocalCandidateAssetRawArtifact } from './local-candidate-asset-raw-artifact.js';
import { TseCandidateAssetNormalizer } from './normalization/tse-candidate-asset-normalizer.js';
import { CandidateAssetPersistenceService } from './persistence/candidate-asset-persistence.js';
import { TseCandidateAssetDatasetSource } from './sources/tse/tse-candidate-asset-dataset-source.js';
import { TseCandidateAssetDatasetParser } from './sources/tse/tse-candidate-asset-parser.js';

async function main(): Promise<void> {
  const year = Number(option('year') ?? '2026');
  const artifact = await openLocalCandidateAssetRawArtifact(
    year,
    option('checksum'),
  );
  const orm = await initializeDatabase();
  const stats = {
    recordsRead: 0,
    parsed: 0,
    parserRejected: 0,
    normalized: 0,
    normalizerRejected: 0,
    assetsInserted: 0,
    assetsUpdated: 0,
    assetsUnchanged: 0,
    candidacyNotFound: 0,
    persistenceRejected: 0,
    sourcesInserted: 0,
    sourcesReused: 0,
  };
  try {
    const parser = new TseCandidateAssetDatasetParser();
    const normalizer = new TseCandidateAssetNormalizer();
    const persistence = new CandidateAssetPersistenceService(orm);
    const importedAt = new Date();
    const iterator = parser.parse(artifact.content, year);
    let next = await iterator.next();
    while (!next.done) {
      stats.recordsRead += 1;
      if (next.value.status === 'REJECTED') stats.parserRejected += 1;
      else {
        stats.parsed += 1;
        const normalized = normalizer.normalize(next.value.record);
        if (normalized.status === 'REJECTED') stats.normalizerRejected += 1;
        else {
          stats.normalized += 1;
          const result = await persistence.persist(normalized.data, {
            sourceType: CandidateSourceType.TSE,
            sourceName: 'Tribunal Superior Eleitoral',
            sourceUrl: new TseCandidateAssetDatasetSource().resolve(year)
              .sourceUrl,
            rawStorageKey: artifact.storageKey,
            rawChecksum: artifact.checksum,
            importedAt,
          });
          if (result.status === 'REJECTED') stats.candidacyNotFound += 1;
          else {
            if (result.status === 'INSERTED') stats.assetsInserted += 1;
            if (result.status === 'UPDATED') stats.assetsUpdated += 1;
            if (result.status === 'UNCHANGED') stats.assetsUnchanged += 1;
            if (result.sourceStatus === 'INSERTED') stats.sourcesInserted += 1;
            else stats.sourcesReused += 1;
          }
        }
      }
      next = await iterator.next();
    }
    console.log(JSON.stringify({ ...stats, parsing: next.value }, null, 2));
  } finally {
    await orm.close();
  }
}

function option(name: string): string | undefined {
  return process.argv
    .slice(2)
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
