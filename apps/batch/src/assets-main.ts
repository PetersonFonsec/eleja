import { resolve } from 'node:path';
import { CandidateAssetDatasetExtractor } from './extraction/candidate-asset-dataset-extractor.js';
import { createRawStorage } from './storage/raw-storage-factory.js';
import { TseCandidateAssetDatasetSource } from './sources/tse/tse-candidate-asset-dataset-source.js';

async function main(): Promise<void> {
  const year = Number(readOption('year') ?? '2026');
  const repositoryRoot = resolve(__dirname, '../../..');
  const rawStorage = createRawStorage(process.env, repositoryRoot);
  const result = await new CandidateAssetDatasetExtractor(
    new TseCandidateAssetDatasetSource(
      fetch,
      Number(process.env.TSE_DOWNLOAD_TIMEOUT_MS ?? 60_000),
    ),
    rawStorage.storage,
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
