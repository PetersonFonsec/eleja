import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { stringify } from 'csv-stringify';

export interface CsvExportResult {
  dataset: 'CANDIDATES' | 'CANDIDATE_ASSETS';
  year: number;
  fileName: string;
  path: string;
  rows: number;
  size: number;
  checksum: string;
}

export async function writeCsvExport(options: {
  dataset: CsvExportResult['dataset'];
  year: number;
  fileName: string;
  outputDirectory: string;
  columns: readonly string[];
  records: AsyncIterable<Record<string, unknown>>;
}): Promise<CsvExportResult> {
  await mkdir(options.outputDirectory, { recursive: true });
  const finalPath = join(options.outputDirectory, options.fileName);
  const temporaryPath = join(
    dirname(finalPath),
    `.${options.fileName}.${randomUUID()}.tmp`,
  );
  let rows = 0;
  async function* countedRecords() {
    for await (const record of options.records) {
      rows += 1;
      yield record;
    }
  }

  try {
    await pipeline(
      Readable.from(countedRecords(), { objectMode: true }),
      stringify({
        columns: [...options.columns],
        header: true,
        delimiter: ',',
        record_delimiter: '\n',
      }),
      createWriteStream(temporaryPath, { flags: 'wx' }),
    );
    await rename(temporaryPath, finalPath);
  } catch (error: unknown) {
    await rm(temporaryPath, { force: true });
    throw error;
  }

  const fileStat = await stat(finalPath);
  return {
    dataset: options.dataset,
    year: options.year,
    fileName: options.fileName,
    path: finalPath,
    rows,
    size: fileStat.size,
    checksum: await sha256(finalPath),
  };
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export function publicText(value: string | null): string {
  if (value === null) return '';
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function publicValue(value: string | number | null): string | number {
  return value ?? '';
}
