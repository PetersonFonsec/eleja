import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import type {
  DatasetPublisher,
  DatasetPublisherPutInput,
  PublishedObject,
} from './dataset-publisher.js';

const VERSIONED_CACHE = 'public, max-age=31536000, immutable';
const LATEST_CACHE = 'public, max-age=300';

interface DatasetManifestEntry {
  name: string;
  file: string;
  rows: number;
  size: number;
  sha256: string;
}

interface LocalManifest {
  year: number;
  generatedAt: string;
  datasets: DatasetManifestEntry[];
}

interface PublicationFile {
  dataset: string;
  file: string;
  path?: string;
  body?: Uint8Array;
  size: number;
  sha256: string;
  contentType: string;
}

export interface DatasetPublicationResult {
  year: number;
  version: string;
  publishedAt: Date;
  files: Array<{
    dataset: string;
    versionedKey: string;
    versionedUrl: string;
    latestKey: string;
    latestUrl: string;
    sha256: string;
  }>;
}

export class PublicDatasetPublication {
  constructor(
    private readonly publisher: DatasetPublisher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async publish(input: {
    year: number;
    version: string;
    exportDirectory: string;
    publishedAt?: Date;
  }): Promise<DatasetPublicationResult> {
    validateVersion(input.year, input.version);
    const manifest = await loadManifest(input.exportDirectory, input.year);
    const localFiles = await verifyDatasetFiles(
      input.exportDirectory,
      manifest,
    );
    const releaseChecksum = releaseIdentity(
      input.year,
      input.version,
      manifest,
    );
    const publishedAt = input.publishedAt ?? this.now();
    const publishedManifest = Buffer.from(
      `${JSON.stringify(
        {
          ...manifest,
          version: input.version,
          publishedAt: publishedAt.toISOString(),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    const files: PublicationFile[] = [
      ...localFiles,
      {
        dataset: 'metadata',
        file: 'metadata.json',
        body: publishedManifest,
        size: publishedManifest.byteLength,
        sha256: digest(publishedManifest),
        contentType: 'application/json; charset=utf-8',
      },
    ];
    const versionPrefix = `datasets/${input.year}/${input.version}`;
    const latestPrefix = `datasets/${input.year}/latest`;

    for (const file of files) {
      await this.publishVersioned(
        file,
        `${versionPrefix}/${file.file}`,
        input,
        releaseChecksum,
      );
    }
    for (const file of files.filter((file) => file.file !== 'metadata.json')) {
      await this.upload(file, `${latestPrefix}/${file.file}`, input, {
        cacheControl: LATEST_CACHE,
        immutable: false,
        releaseChecksum,
      });
    }
    const metadata = files.at(-1)!;
    await this.upload(metadata, `${latestPrefix}/metadata.json`, input, {
      cacheControl: LATEST_CACHE,
      immutable: false,
      releaseChecksum,
    });

    return {
      year: input.year,
      version: input.version,
      publishedAt,
      files: files.map((file) => {
        const versionedKey = `${versionPrefix}/${file.file}`;
        const latestKey = `${latestPrefix}/${file.file}`;
        return {
          dataset: file.dataset,
          versionedKey,
          versionedUrl: this.publisher.publicUrl(versionedKey),
          latestKey,
          latestUrl: this.publisher.publicUrl(latestKey),
          sha256: file.sha256,
        };
      }),
    };
  }

  private async publishVersioned(
    file: PublicationFile,
    key: string,
    input: { year: number; version: string },
    releaseChecksum: string,
  ): Promise<void> {
    const existing = await this.publisher.inspect(key);
    if (existing) {
      assertHistoricalMatch(existing, file);
      return;
    }
    await this.upload(file, key, input, {
      cacheControl: VERSIONED_CACHE,
      immutable: true,
      releaseChecksum,
    });
  }

  private async upload(
    file: PublicationFile,
    key: string,
    input: { year: number; version: string },
    options: {
      cacheControl: string;
      immutable: boolean;
      releaseChecksum: string;
    },
  ): Promise<void> {
    const put: DatasetPublisherPutInput = {
      key,
      body: file.path ? createReadStream(file.path) : Readable.from(file.body!),
      size: file.size,
      contentType: file.contentType,
      contentDisposition: file.contentType.startsWith('text/csv')
        ? `attachment; filename="${basename(file.file)}"`
        : undefined,
      cacheControl: options.cacheControl,
      metadata: {
        sha256: file.sha256,
        dataset: file.dataset,
        version: input.version,
        year: String(input.year),
        'release-sha256': options.releaseChecksum,
      },
      immutable: options.immutable,
    };
    await this.publisher.put(put);
    const stored = await this.publisher.inspect(key);
    if (
      !stored ||
      stored.size !== file.size ||
      stored.metadata.sha256 !== file.sha256
    ) {
      throw new Error(`Uploaded dataset verification failed at ${key}`);
    }
  }
}

async function loadManifest(
  directory: string,
  expectedYear: number,
): Promise<LocalManifest> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      await readFile(join(directory, 'metadata.json'), 'utf8'),
    );
  } catch (error: unknown) {
    throw new Error('Cannot read a valid local metadata.json', {
      cause: error,
    });
  }
  if (!isManifest(parsed) || parsed.year !== expectedYear) {
    throw new Error(
      `Local metadata.json does not describe year ${expectedYear}`,
    );
  }
  const expectedFiles = ['candidate-assets.csv', 'candidates.csv'];
  const actualFiles = parsed.datasets.map(({ file }) => file).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error('Local metadata.json must describe the public CSV files');
  }
  return parsed;
}

async function verifyDatasetFiles(
  directory: string,
  manifest: LocalManifest,
): Promise<PublicationFile[]> {
  const files: PublicationFile[] = [];
  for (const dataset of manifest.datasets) {
    if (basename(dataset.file) !== dataset.file) {
      throw new Error(`Invalid dataset filename in metadata: ${dataset.file}`);
    }
    const path = join(directory, dataset.file);
    const fileStat = await stat(path).catch(() => null);
    if (!fileStat?.isFile() || fileStat.size !== dataset.size) {
      throw new Error(`Dataset size does not match metadata: ${dataset.file}`);
    }
    const checksum = await sha256(path);
    if (checksum !== dataset.sha256) {
      throw new Error(
        `Dataset checksum does not match metadata: ${dataset.file}`,
      );
    }
    files.push({
      dataset: dataset.name,
      file: dataset.file,
      path,
      size: dataset.size,
      sha256: checksum,
      contentType: 'text/csv; charset=utf-8',
    });
  }
  return files;
}

function assertHistoricalMatch(
  existing: PublishedObject,
  file: PublicationFile,
): void {
  if (existing.metadata.sha256 !== file.sha256 || existing.size !== file.size) {
    throw new Error(`Immutable dataset conflict at ${existing.key}`);
  }
}

function validateVersion(year: number, version: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(version)) {
    throw new Error('Dataset version must use YYYY-MM-DD');
  }
  const date = new Date(`${version}T00:00:00.000Z`);
  if (
    Number.isNaN(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== version
  ) {
    throw new Error('Dataset version must be a valid date');
  }
  if (Number(version.slice(0, 4)) !== year) {
    throw new Error('Dataset version year must match --year');
  }
}

function isManifest(value: unknown): value is LocalManifest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LocalManifest>;
  return (
    Number.isSafeInteger(candidate.year) &&
    typeof candidate.generatedAt === 'string' &&
    Array.isArray(candidate.datasets) &&
    candidate.datasets.length > 0 &&
    candidate.datasets.every(
      (dataset) =>
        dataset &&
        typeof dataset.name === 'string' &&
        typeof dataset.file === 'string' &&
        Number.isSafeInteger(dataset.rows) &&
        Number.isSafeInteger(dataset.size) &&
        typeof dataset.sha256 === 'string' &&
        /^[a-f0-9]{64}$/.test(dataset.sha256),
    )
  );
}

function releaseIdentity(
  year: number,
  version: string,
  manifest: LocalManifest,
): string {
  return digest(
    Buffer.from(
      JSON.stringify({ year, version, datasets: manifest.datasets }),
      'utf8',
    ),
  );
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function digest(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}
