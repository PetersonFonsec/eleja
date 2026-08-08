import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TseCandidateDatasetParser } from './sources/tse/tse-candidate-parser.js';
import { FileSystemRawStorage } from './storage/file-system-raw-storage.js';

interface ParseArguments {
  electionYear: number;
  checksum?: string;
}

function readOption(arguments_: string[], name: string): string | undefined {
  const inline = arguments_.find((argument) =>
    argument.startsWith(`--${name}=`),
  );
  const index = arguments_.indexOf(`--${name}`);
  return (
    inline?.slice(name.length + 3) ??
    (index >= 0 ? arguments_[index + 1] : undefined)
  );
}

function readArguments(arguments_: string[]): ParseArguments {
  const electionYear = Number(readOption(arguments_, 'year') ?? '2026');
  const checksum = readOption(arguments_, 'checksum');
  if (!Number.isSafeInteger(electionYear) || electionYear < 1900) {
    throw new Error('Election year must be a valid integer');
  }
  if (checksum && !/^[a-f0-9]{64}$/i.test(checksum)) {
    throw new Error('Checksum must be a 64-character SHA-256 value');
  }
  return { electionYear, checksum: checksum?.toLowerCase() };
}

async function selectChecksum(
  rawStorageRoot: string,
  electionYear: number,
  requestedChecksum?: string,
): Promise<string> {
  if (requestedChecksum) return requestedChecksum;

  const candidatesRoot = resolve(
    rawStorageRoot,
    'tse',
    String(electionYear),
    'candidates',
  );
  const entries = await readdir(candidatesRoot, { withFileTypes: true }).catch(
    (error: unknown) => {
      throw new Error(
        `No local TSE candidate RAW artifacts found for ${electionYear}`,
        { cause: error },
      );
    },
  );
  const checksums = entries
    .filter(
      (entry) => entry.isDirectory() && /^[a-f0-9]{64}$/i.test(entry.name),
    )
    .map((entry) => entry.name.toLowerCase())
    .sort();

  if (checksums.length === 0) {
    throw new Error(
      `No local TSE candidate RAW artifacts found for ${electionYear}`,
    );
  }
  if (checksums.length > 1) {
    throw new Error(
      `Multiple RAW artifacts found for ${electionYear}; select one with --checksum=<sha256>`,
    );
  }
  return checksums[0]!;
}

async function main(): Promise<void> {
  const { electionYear, checksum: requestedChecksum } = readArguments(
    process.argv.slice(2),
  );
  const repositoryRoot = resolve(__dirname, '../../..');
  const rawStorageRoot = resolve(
    repositoryRoot,
    process.env.RAW_STORAGE_ROOT ?? '.data/raw',
  );
  const checksum = await selectChecksum(
    rawStorageRoot,
    electionYear,
    requestedChecksum,
  );
  const storageKey = `tse/${electionYear}/candidates/${checksum}/consulta_cand_${electionYear}.zip`;
  const storage = new FileSystemRawStorage(rawStorageRoot);
  const rawArchive = await storage.get(storageKey);
  const parser = new TseCandidateDatasetParser();
  const iterator = parser.parse(rawArchive, electionYear);

  console.log('TSE candidate parsing started');
  console.log(`Artifact: ${storageKey}`);
  console.log(`CSV entry: consulta_cand_${electionYear}_BRASIL.csv`);
  console.log('Encoding: ISO-8859-1');
  console.log('Delimiter: ;');

  let next = await iterator.next();
  while (!next.done) {
    next = await iterator.next();
  }
  const statistics = next.value;

  console.log('TSE candidate parsing completed');
  console.log(`Records read: ${statistics.recordsRead}`);
  console.log(`Parsed: ${statistics.recordsParsed}`);
  console.log(`Rejected: ${statistics.recordsRejected}`);
  console.log(`Duration: ${statistics.durationMs}ms`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
