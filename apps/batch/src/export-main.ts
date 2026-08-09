import { initializeDatabase } from '@eleja/database';
import { resolve } from 'node:path';
import { PublicDatasetExporter } from './export/public-dataset-exporter.js';

async function main(): Promise<void> {
  const year = Number(readOption('year') ?? '2026');
  if (!Number.isSafeInteger(year) || year < 1800 || year > 9999) {
    throw new Error('year must be an integer between 1800 and 9999');
  }
  const batchSize = Number(process.env.CSV_EXPORT_BATCH_SIZE ?? 1000);
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
    throw new Error('CSV_EXPORT_BATCH_SIZE must be a positive integer');
  }
  const repositoryRoot = resolve(__dirname, '../../..');
  const exportRoot = resolve(
    repositoryRoot,
    process.env.CSV_EXPORT_ROOT ?? '.data/exports',
  );
  const outputDirectory = resolve(exportRoot, String(year));
  const orm = await initializeDatabase();
  const startedAt = performance.now();
  try {
    const result = await new PublicDatasetExporter(orm, batchSize).export(
      year,
      outputDirectory,
    );
    console.log(
      JSON.stringify(
        {
          ...result,
          durationMs: Math.round(performance.now() - startedAt),
          datasets: result.datasets.map(
            ({ dataset, fileName, rows, size, checksum }) => ({
              dataset,
              fileName,
              rows,
              size,
              sha256: checksum,
            }),
          ),
        },
        null,
        2,
      ),
    );
  } finally {
    await orm.close();
  }
}

function readOption(name: string): string | undefined {
  return process.argv
    .slice(2)
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
