import {
  DatasetVersion,
  DatasetVersionStatus,
  type initializeDatabase,
} from '@eleja/database';
import { describe, expect, it, vi } from 'vitest';
import { DatasetPublicationJob } from '../src/publication/dataset-publication-job.js';
import type { DatasetPublicationResult } from '../src/publication/public-dataset-publication.js';

const input = {
  year: 2026,
  version: '2026-08-08',
  exportDirectory: '/exports/2026',
};
const publishedAt = new Date('2026-08-08T12:00:00.000Z');
const result: DatasetPublicationResult = {
  year: 2026,
  version: '2026-08-08',
  publishedAt,
  files: [],
};

describe('DatasetPublicationJob', () => {
  it('marks a ready version published only after storage succeeds', async () => {
    const dataset = readyDataset();
    const flush = vi.fn(async () => undefined);
    const publication = { publish: vi.fn(async () => result) };

    await expect(
      new DatasetPublicationJob(database(dataset, flush), publication).execute(
        input,
      ),
    ).resolves.toBe(result);

    expect(dataset.status).toBe(DatasetVersionStatus.PUBLISHED);
    expect(dataset.publishedAt).toEqual(publishedAt);
    expect(flush).toHaveBeenCalledOnce();
  });

  it('keeps a ready version unchanged when storage publication fails', async () => {
    const dataset = readyDataset();
    const flush = vi.fn(async () => undefined);
    const publication = {
      publish: vi.fn(async (): Promise<DatasetPublicationResult> => {
        throw new Error('R2 failed');
      }),
    };

    await expect(
      new DatasetPublicationJob(database(dataset, flush), publication).execute(
        input,
      ),
    ).rejects.toThrow('R2 failed');

    expect(dataset.status).toBe(DatasetVersionStatus.READY);
    expect(dataset.publishedAt).toBeNull();
    expect(flush).not.toHaveBeenCalled();
  });

  it('rejects a processing version before touching storage', async () => {
    const dataset = new DatasetVersion(input.version);
    const publication = { publish: vi.fn(async () => result) };

    await expect(
      new DatasetPublicationJob(
        database(
          dataset,
          vi.fn(async () => undefined),
        ),
        publication,
      ).execute(input),
    ).rejects.toThrow('Cannot publish dataset in PROCESSING status');
    expect(publication.publish).not.toHaveBeenCalled();
  });

  it('allows an idempotent retry of an already published version', async () => {
    const dataset = readyDataset();
    dataset.publish(publishedAt);
    const flush = vi.fn(async () => undefined);
    const publication = { publish: vi.fn(async () => result) };

    await new DatasetPublicationJob(
      database(dataset, flush),
      publication,
    ).execute(input);

    expect(publication.publish).toHaveBeenCalledWith({
      ...input,
      publishedAt,
    });
    expect(flush).not.toHaveBeenCalled();
    expect(dataset.publishedAt).toEqual(publishedAt);
  });
});

function readyDataset() {
  const dataset = new DatasetVersion(input.version);
  dataset.markReady();
  return dataset;
}

function database(dataset: DatasetVersion, flush: () => Promise<void>) {
  return {
    em: {
      fork: () => ({
        findOne: async () => dataset,
        flush,
      }),
    },
  } as unknown as Awaited<ReturnType<typeof initializeDatabase>>;
}
