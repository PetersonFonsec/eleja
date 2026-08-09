import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  DatasetPublisher,
  DatasetPublisherPutInput,
  PublishedObject,
} from '../src/publication/dataset-publisher.js';
import { PublicDatasetPublication } from '../src/publication/public-dataset-publication.js';

describe('PublicDatasetPublication', () => {
  let directory: string;
  let publisher: MemoryPublisher;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'eleja-publication-'));
    await createExportFixture(directory);
    publisher = new MemoryPublisher();
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('publishes the immutable version before latest and metadata last', async () => {
    const result = await publication(publisher).publish(input(directory));

    expect(publisher.operations).toEqual([
      'datasets/2026/2026-08-08/candidates.csv',
      'datasets/2026/2026-08-08/candidate-assets.csv',
      'datasets/2026/2026-08-08/metadata.json',
      'datasets/2026/latest/candidates.csv',
      'datasets/2026/latest/candidate-assets.csv',
      'datasets/2026/latest/metadata.json',
    ]);
    expect(result.files[0]?.latestUrl).toBe(
      'https://data.example.com/datasets/2026/latest/candidates.csv',
    );
    expect(publisher.inputs[0]).toMatchObject({
      contentType: 'text/csv; charset=utf-8',
      contentDisposition: 'attachment; filename="candidates.csv"',
      cacheControl: 'public, max-age=31536000, immutable',
      immutable: true,
    });
    expect(publisher.inputs.at(-1)).toMatchObject({
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=300',
      immutable: false,
    });
    const metadata = JSON.parse(
      publisher.contents.get('datasets/2026/latest/metadata.json')!.toString(),
    );
    expect(metadata).toMatchObject({
      year: 2026,
      version: '2026-08-08',
      publishedAt: '2026-08-08T12:00:00.000Z',
    });
  });

  it('is idempotent for an identical historical release', async () => {
    const service = publication(publisher);
    await service.publish(input(directory));
    publisher.operations.length = 0;

    await service.publish(input(directory));

    expect(publisher.operations).toEqual([
      'datasets/2026/latest/candidates.csv',
      'datasets/2026/latest/candidate-assets.csv',
      'datasets/2026/latest/metadata.json',
    ]);
  });

  it('rejects a conflicting immutable historical object', async () => {
    await publication(publisher).publish(input(directory));
    publisher.objects.get(
      'datasets/2026/2026-08-08/candidates.csv',
    )!.metadata.sha256 = '0'.repeat(64);

    await expect(
      publication(publisher).publish(input(directory)),
    ).rejects.toThrow('Immutable dataset conflict');
  });

  it('does not update latest when a versioned upload fails', async () => {
    publisher.failAtKey = 'datasets/2026/2026-08-08/candidate-assets.csv';

    await expect(
      publication(publisher).publish(input(directory)),
    ).rejects.toThrow('simulated upload failure');
    expect(publisher.operations.some((key) => key.includes('/latest/'))).toBe(
      false,
    );
  });

  it('keeps the historical release when updating latest fails', async () => {
    publisher.failAtKey = 'datasets/2026/latest/candidate-assets.csv';

    await expect(
      publication(publisher).publish(input(directory)),
    ).rejects.toThrow('simulated upload failure');
    expect(
      publisher.objects.has('datasets/2026/2026-08-08/metadata.json'),
    ).toBe(true);
    expect(publisher.objects.has('datasets/2026/latest/metadata.json')).toBe(
      false,
    );
  });

  it('validates local checksums before any upload', async () => {
    await writeFile(join(directory, 'candidates.csv'), 'changed\n');

    await expect(
      publication(publisher).publish(input(directory)),
    ).rejects.toThrow('Dataset size does not match metadata: candidates.csv');
    expect(publisher.operations).toEqual([]);
  });
});

class MemoryPublisher implements DatasetPublisher {
  objects = new Map<string, PublishedObject>();
  contents = new Map<string, Buffer>();
  operations: string[] = [];
  inputs: DatasetPublisherPutInput[] = [];
  failAtKey?: string;

  async inspect(key: string) {
    return this.objects.get(key) ?? null;
  }

  async put(input: DatasetPublisherPutInput) {
    this.operations.push(input.key);
    this.inputs.push(input);
    if (input.key === this.failAtKey) {
      throw new Error('simulated upload failure');
    }
    const content = await consume(input.body);
    this.contents.set(input.key, content);
    this.objects.set(input.key, {
      key: input.key,
      size: input.size,
      metadata: { ...input.metadata },
    });
  }

  publicUrl(key: string) {
    return `https://data.example.com/${key}`;
  }
}

function publication(publisher: DatasetPublisher) {
  return new PublicDatasetPublication(
    publisher,
    () => new Date('2026-08-08T12:00:00.000Z'),
  );
}

function input(exportDirectory: string) {
  return { year: 2026, version: '2026-08-08', exportDirectory };
}

async function createExportFixture(directory: string) {
  const candidates = Buffer.from('candidate_id,name\n1,Ana\n');
  const assets = Buffer.from('asset_id,candidate_id,value\n2,1,10.20\n');
  await writeFile(join(directory, 'candidates.csv'), candidates);
  await writeFile(join(directory, 'candidate-assets.csv'), assets);
  await writeFile(
    join(directory, 'metadata.json'),
    `${JSON.stringify({
      year: 2026,
      generatedAt: '2026-08-08T11:00:00.000Z',
      datasets: [
        entry('candidates', 'candidates.csv', 1, candidates),
        entry('candidate-assets', 'candidate-assets.csv', 1, assets),
      ],
    })}\n`,
  );
  expect(await readFile(join(directory, 'metadata.json'))).not.toHaveLength(0);
}

function entry(name: string, file: string, rows: number, body: Buffer) {
  return {
    name,
    file,
    rows,
    size: body.byteLength,
    sha256: createHash('sha256').update(body).digest('hex'),
  };
}

async function consume(body: Readable | Uint8Array): Promise<Buffer> {
  if (body instanceof Uint8Array) return Buffer.from(body);
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
