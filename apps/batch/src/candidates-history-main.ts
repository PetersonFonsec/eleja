import { initializeDatabase } from '@eleja/database';
import { resolve } from 'node:path';
import { readHistoricalYears } from './historical-years.js';
import { AssetImportPipeline } from './orchestration/asset-import-pipeline.js';
import { CandidateImportPipeline } from './orchestration/candidate-import-pipeline.js';
import {
  createDatasetExporter,
  ElectoralDatasetPipeline,
} from './orchestration/electoral-dataset-pipeline.js';
import { MikroOrmPipelineExecutionStore } from './orchestration/mikro-orm-pipeline-execution-store.js';

async function main(): Promise<void> {
  const years = readHistoricalYears(process.argv.slice(2));
  const root = resolve(__dirname, '../../..');
  const rawRoot = resolve(root, process.env.RAW_STORAGE_ROOT ?? '.data/raw');
  const exportRoot = resolve(
    root,
    process.env.CSV_EXPORT_ROOT ?? '.data/exports',
  );
  const timeout = positiveInteger(
    process.env.TSE_DOWNLOAD_TIMEOUT_MS ?? '60000',
    'TSE_DOWNLOAD_TIMEOUT_MS',
  );
  const persistBatchSize = positiveInteger(
    process.env.CANDIDATE_PERSIST_BATCH_SIZE ?? '500',
    'CANDIDATE_PERSIST_BATCH_SIZE',
  );
  const exportBatchSize = positiveInteger(
    process.env.CSV_EXPORT_BATCH_SIZE ?? '1000',
    'CSV_EXPORT_BATCH_SIZE',
  );
  const orm = await initializeDatabase();
  const results = [];
  try {
    for (const year of years) {
      const pipeline = new ElectoralDatasetPipeline(
        orm,
        new MikroOrmPipelineExecutionStore(orm),
        new CandidateImportPipeline(orm, rawRoot, timeout, persistBatchSize),
        new AssetImportPipeline(orm, rawRoot, timeout),
        createDatasetExporter(orm, exportBatchSize),
        exportRoot,
      );
      results.push(await pipeline.execute(year, historicalVersion(year)));
    }
    console.log(
      JSON.stringify(
        { years, results, crossElection: await crossElectionStatistics(orm) },
        null,
        2,
      ),
    );
  } finally {
    await orm.close();
  }
}

function historicalVersion(year: number): string {
  const now = new Date();
  return `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function crossElectionStatistics(
  orm: Awaited<ReturnType<typeof initializeDatabase>>,
) {
  const connection = orm.em.getConnection();
  const candidacies = await connection.execute<
    Array<{ candidacy_count: string; people: string }>
  >(
    `select candidacy_count::text, count(*)::text as people from (select person_id, count(*) as candidacy_count from candidacies group by person_id) grouped group by candidacy_count order by candidacy_count`,
  );
  const [assets] = await connection.execute<Array<{ people: string }>>(
    `select count(*)::text as people from (select c.person_id from candidate_assets a join candidacies c on c.id = a.candidacy_id join elections e on e.id = c.election_id group by c.person_id having count(distinct e.year) >= 2) grouped`,
  );
  const distribution = new Map(
    candidacies.map((row) => [Number(row.candidacy_count), Number(row.people)]),
  );
  return {
    personsWithOneCandidacy: distribution.get(1) ?? 0,
    personsWithTwoCandidacies: distribution.get(2) ?? 0,
    personsWithThreeOrMoreCandidacies: [...distribution.entries()]
      .filter(([count]) => count >= 3)
      .reduce((total, [, people]) => total + people, 0),
    personsWithAssetsInTwoOrMoreElections: Number(assets?.people ?? 0),
  };
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
