import { initializeDatabase } from '@eleja/database';
import { resolve } from 'node:path';
import { DatasetPublicationJob } from './publication/dataset-publication-job.js';
import { PublicDatasetPublication } from './publication/public-dataset-publication.js';
import { R2DatasetPublisher } from './publication/r2-dataset-publisher.js';
import { readR2Config } from './publication/r2-config.js';

async function main(): Promise<void> {
  const year = Number(requiredOption('year'));
  if (!Number.isSafeInteger(year) || year < 1800 || year > 9999) {
    throw new Error('year must be an integer between 1800 and 9999');
  }
  const version = requiredOption('version');
  const repositoryRoot = resolve(__dirname, '../../..');
  const exportRoot = resolve(
    repositoryRoot,
    process.env.CSV_EXPORT_ROOT ?? '.data/exports',
  );
  const exportDirectory = resolve(exportRoot, String(year));
  const config = readR2Config();
  const orm = await initializeDatabase();
  try {
    const result = await new DatasetPublicationJob(
      orm,
      new PublicDatasetPublication(new R2DatasetPublisher(config)),
    ).execute({ year, version, exportDirectory });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await orm.close();
  }
}

function requiredOption(name: string): string {
  const value = process.argv
    .slice(2)
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3)
    .trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
