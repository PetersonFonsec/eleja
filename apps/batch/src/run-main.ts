import { initializeDatabase } from '@eleja/database';
import { resolve } from 'node:path';
import { AssetImportPipeline } from './orchestration/asset-import-pipeline.js';
import { CandidateImportPipeline } from './orchestration/candidate-import-pipeline.js';
import {
  createDatasetExporter,
  ElectoralDatasetPipeline,
} from './orchestration/electoral-dataset-pipeline.js';
import { MikroOrmPipelineExecutionStore } from './orchestration/mikro-orm-pipeline-execution-store.js';

async function main(): Promise<void> {
  const year = readYear(process.argv.slice(2));
  const version = readVersion(process.argv.slice(2)) ?? todayVersion();
  validateVersion(year, version);
  const repositoryRoot = resolve(__dirname, '../../..');
  const rawRoot = resolve(
    repositoryRoot,
    process.env.RAW_STORAGE_ROOT ?? '.data/raw',
  );
  const exportRoot = resolve(
    repositoryRoot,
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
  try {
    console.log(`[Eleja Batch]\nYear: ${year}\nVersion: ${version}`);
    const result = await new ElectoralDatasetPipeline(
      orm,
      new MikroOrmPipelineExecutionStore(orm),
      new CandidateImportPipeline(orm, rawRoot, timeout, persistBatchSize),
      new AssetImportPipeline(orm, rawRoot, timeout),
      createDatasetExporter(orm, exportBatchSize),
      exportRoot,
    ).execute(year, version);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await orm.close();
  }
}

export function readYear(arguments_: string[]): number {
  const raw = option(arguments_, 'year');
  if (raw === undefined) throw new Error('--year is required');
  const year = Number(raw);
  if (!Number.isSafeInteger(year) || year < 1900 || year > 9999) {
    throw new Error('--year must be an integer between 1900 and 9999');
  }
  return year;
}

function readVersion(arguments_: string[]): string | undefined {
  return option(arguments_, 'version');
}

function option(arguments_: string[], name: string): string | undefined {
  const inline = arguments_.find((argument) =>
    argument.startsWith(`--${name}=`),
  );
  const index = arguments_.indexOf(`--${name}`);
  return (
    inline?.slice(name.length + 3) ??
    (index >= 0 ? arguments_[index + 1] : undefined)
  );
}

function todayVersion(): string {
  const today = new Date();
  return [
    String(today.getFullYear()).padStart(4, '0'),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
}

function validateVersion(year: number, version: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(version)) {
    throw new Error('--version must use YYYY-MM-DD');
  }
  const date = new Date(`${version}T00:00:00.000Z`);
  if (date.toISOString().slice(0, 10) !== version) {
    throw new Error('--version must be a valid date');
  }
  if (Number(version.slice(0, 4)) !== year) {
    throw new Error('--version year must match --year');
  }
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
