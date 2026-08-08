import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { FileSystemRawStorage } from './storage/file-system-raw-storage.js';

export interface CandidateArtifactArguments {
  electionYear: number;
  checksum?: string;
}

export interface LocalCandidateRawArtifact {
  electionYear: number;
  checksum: string;
  storageKey: string;
  content: Readable;
}

export function readCandidateArtifactArguments(
  arguments_: string[],
): CandidateArtifactArguments {
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

export async function openLocalCandidateRawArtifact(
  arguments_: CandidateArtifactArguments,
): Promise<LocalCandidateRawArtifact> {
  const repositoryRoot = resolve(__dirname, '../../..');
  const rawStorageRoot = resolve(
    repositoryRoot,
    process.env.RAW_STORAGE_ROOT ?? '.data/raw',
  );
  const checksum = await selectChecksum(
    rawStorageRoot,
    arguments_.electionYear,
    arguments_.checksum,
  );
  const storageKey = `tse/${arguments_.electionYear}/candidates/${checksum}/consulta_cand_${arguments_.electionYear}.zip`;
  const content = await new FileSystemRawStorage(rawStorageRoot).get(
    storageKey,
  );
  return { ...arguments_, checksum, storageKey, content };
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
