import { resolve } from 'node:path';
import { CandidateDatasetExtractor } from './extraction/candidate-dataset-extractor.js';
import { TseCandidateDatasetSource } from './sources/tse/tse-candidate-dataset-source.js';
import { FileSystemRawStorage } from './storage/file-system-raw-storage.js';

function readElectionYear(arguments_: string[]): number {
  const inline = arguments_.find((argument) => argument.startsWith('--year='));
  const yearIndex = arguments_.indexOf('--year');
  const rawYear =
    inline?.slice('--year='.length) ??
    (yearIndex >= 0 ? arguments_[yearIndex + 1] : undefined) ??
    '2026';
  return Number(rawYear);
}

async function main(): Promise<void> {
  const electionYear = readElectionYear(process.argv.slice(2));
  const timeoutMs = Number(process.env.TSE_DOWNLOAD_TIMEOUT_MS ?? 60_000);
  const repositoryRoot = resolve(__dirname, '../../..');
  const rawStorageRoot = resolve(
    repositoryRoot,
    process.env.RAW_STORAGE_ROOT ?? '.data/raw',
  );
  const source = new TseCandidateDatasetSource(fetch, timeoutMs);
  const extractor = new CandidateDatasetExtractor(
    source,
    new FileSystemRawStorage(rawStorageRoot),
  );

  console.log('TSE candidate extraction started');
  console.log(`Election year: ${electionYear}`);
  console.log(`Resolved source: ${source.resolve(electionYear).sourceUrl}`);

  const result = await extractor.extract(electionYear);

  console.log(`Downloaded: size=${result.size} checksum=${result.checksum}`);
  console.log(`RAW stored: key=${result.storageKey} stored=${result.stored}`);
  console.log('TSE candidate extraction finished');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
