import type { initializeDatabase } from '@eleja/database';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CandidateAssetCsvExporter } from './candidate-asset-csv-exporter.js';
import { CandidateCsvExporter } from './candidate-csv-exporter.js';
import type { CsvExportResult } from './csv-export-writer.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;

export class PublicDatasetExporter {
  constructor(
    private readonly orm: Database,
    private readonly batchSize = 1000,
  ) {}

  async export(year: number, outputDirectory: string) {
    const candidates = await new CandidateCsvExporter(
      this.orm,
      this.batchSize,
    ).export(year, outputDirectory);
    const assets = await new CandidateAssetCsvExporter(
      this.orm,
      this.batchSize,
    ).export(year, outputDirectory);
    const datasets = [candidates, assets];
    await writeMetadata(year, outputDirectory, datasets);
    return { year, generatedAt: new Date(), datasets };
  }
}

async function writeMetadata(
  year: number,
  outputDirectory: string,
  datasets: CsvExportResult[],
): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  const finalPath = join(outputDirectory, 'metadata.json');
  const temporaryPath = join(
    outputDirectory,
    `.metadata.json.${randomUUID()}.tmp`,
  );
  const metadata = {
    year,
    generatedAt: new Date().toISOString(),
    datasets: datasets.map(({ dataset, fileName, rows, size, checksum }) => ({
      name: dataset === 'CANDIDATES' ? 'candidates' : 'candidate-assets',
      file: fileName,
      rows,
      size,
      sha256: checksum,
    })),
  };
  try {
    await writeFile(temporaryPath, `${JSON.stringify(metadata, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    await rename(temporaryPath, finalPath);
  } catch (error: unknown) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}
