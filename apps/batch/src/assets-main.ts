import { resolve } from 'node:path';
import { CandidateAssetDatasetExtractor } from './extraction/candidate-asset-dataset-extractor.js';
import { FileSystemRawStorage } from './storage/file-system-raw-storage.js';
import { TseCandidateAssetDatasetSource } from './sources/tse/tse-candidate-asset-dataset-source.js';

async function main(): Promise<void> {
  const year = Number(readOption('year') ?? '2026');
  const root = resolve(
    __dirname,
    '../../..',
    process.env.RAW_STORAGE_ROOT ?? '.data/raw',
  );
  const result = await new CandidateAssetDatasetExtractor(
    new TseCandidateAssetDatasetSource(
      fetch,
      Number(process.env.TSE_DOWNLOAD_TIMEOUT_MS ?? 60_000),
    ),
    new FileSystemRawStorage(root),
  ).extract(year);
  console.log(JSON.stringify(result, null, 2));
}

function readOption(name: string): string | undefined {
  const args = process.argv.slice(2);
  return args
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
