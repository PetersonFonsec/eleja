import { describe, expect, it } from 'vitest';
import { DatasetVersion } from '../src/entities/dataset-version.entity.js';
import { DatasetVersionStatus } from '../src/entities/dataset-version-status.js';

const startedAt = new Date('2026-08-08T09:00:00.000Z');
const finishedAt = new Date('2026-08-08T09:30:00.000Z');
const publishedAt = new Date('2026-08-08T10:00:00.000Z');

describe('DatasetVersion', () => {
  it('starts processing with zero counters', () => {
    const dataset = new DatasetVersion('2026-08-08', null, startedAt);

    expect(dataset.status).toBe(DatasetVersionStatus.PROCESSING);
    expect(dataset.startedAt).toEqual(startedAt);
    expect(dataset.recordsRead).toBe(0);
    expect(dataset.recordsInserted).toBe(0);
    expect(dataset.recordsUpdated).toBe(0);
    expect(dataset.recordsRejected).toBe(0);
  });

  it('moves from processing to ready and then published', () => {
    const dataset = new DatasetVersion('2026-08-08', null, startedAt);

    dataset.markReady(finishedAt);
    expect(dataset.status).toBe(DatasetVersionStatus.READY);
    expect(dataset.finishedAt).toEqual(finishedAt);

    dataset.publish(publishedAt);
    expect(dataset.status).toBe(DatasetVersionStatus.PUBLISHED);
    expect(dataset.publishedAt).toEqual(publishedAt);
  });

  it('cannot publish while processing', () => {
    const dataset = new DatasetVersion('2026-08-08', null, startedAt);

    expect(() => dataset.publish(publishedAt)).toThrow(
      'Cannot publish dataset in PROCESSING status',
    );
  });

  it('records failure completion and cannot then be published', () => {
    const dataset = new DatasetVersion('2026-08-08', null, startedAt);

    dataset.markFailed(finishedAt);

    expect(dataset.status).toBe(DatasetVersionStatus.FAILED);
    expect(dataset.finishedAt).toEqual(finishedAt);
    expect(() => dataset.publish(publishedAt)).toThrow(
      'Cannot publish dataset in FAILED status',
    );
  });

  it('records validated counters', () => {
    const dataset = new DatasetVersion('2026-08-08', null, startedAt);

    dataset.recordCounters({
      recordsRead: 10,
      recordsInserted: 7,
      recordsUpdated: 2,
      recordsRejected: 1,
    });

    expect(dataset.recordsRead).toBe(10);
    expect(dataset.recordsInserted).toBe(7);
    expect(dataset.recordsUpdated).toBe(2);
    expect(dataset.recordsRejected).toBe(1);
  });
});
