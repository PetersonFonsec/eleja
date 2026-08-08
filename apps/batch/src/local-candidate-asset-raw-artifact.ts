import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FileSystemRawStorage } from './storage/file-system-raw-storage.js';

export async function openLocalCandidateAssetRawArtifact(
  electionYear: number,
  requestedChecksum?: string,
) {
  const repositoryRoot = resolve(__dirname, '../../..');
  const root = resolve(
    repositoryRoot,
    process.env.RAW_STORAGE_ROOT ?? '.data/raw',
  );
  const directory = resolve(root, 'tse', String(electionYear), 'assets');
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  const checksums = entries
    .filter((entry) => entry.isDirectory() && /^[a-f0-9]{64}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const checksum =
    requestedChecksum ?? (checksums.length === 1 ? checksums[0] : undefined);
  if (!checksum)
    throw new Error(
      `Select one asset RAW artifact for ${electionYear} with --checksum`,
    );
  if (!/^[a-f0-9]{64}$/.test(checksum))
    throw new Error('Checksum must be SHA-256');
  const storageKey = `tse/${electionYear}/assets/${checksum}/bem_candidato_${electionYear}.zip`;
  const content = await new FileSystemRawStorage(root).get(storageKey);
  return { electionYear, checksum, storageKey, content };
}
