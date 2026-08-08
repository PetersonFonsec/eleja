import { describe, expect, it } from 'vitest';
import { BatchRun } from '../src/entities/batch-run.entity.js';
import { BatchRunStatus } from '../src/entities/batch-run-status.js';
import { DatasetVersion } from '../src/entities/dataset-version.entity.js';

const startedAt = new Date('2026-08-08T09:00:00.000Z');
const finishedAt = new Date('2026-08-08T09:30:00.000Z');

function createBatchRun(): BatchRun {
  const dataset = new DatasetVersion('2026-08-08', null, startedAt);
  return new BatchRun(dataset, 'TSE_CANDIDATES', startedAt);
}

describe('BatchRun', () => {
  it('starts running with zero counters', () => {
    const run = createBatchRun();

    expect(run.status).toBe(BatchRunStatus.RUNNING);
    expect(run.recordsRead).toBe(0);
    expect(run.finishedAt).toBeNull();
  });

  it.each([
    [
      'success',
      BatchRunStatus.SUCCESS,
      (run: BatchRun) => run.markSuccess(finishedAt),
    ],
    [
      'partial',
      BatchRunStatus.PARTIAL,
      (run: BatchRun) => run.markPartial(finishedAt),
    ],
  ])('can finish as %s', (_name, expectedStatus, finish) => {
    const run = createBatchRun();

    finish(run);

    expect(run.status).toBe(expectedStatus);
    expect(run.finishedAt).toEqual(finishedAt);
  });

  it('records counters while running', () => {
    const run = createBatchRun();

    run.recordCounters({
      recordsRead: 10,
      recordsInserted: 7,
      recordsUpdated: 2,
      recordsRejected: 1,
    });

    expect(run.recordsRead).toBe(10);
    expect(run.recordsInserted).toBe(7);
    expect(run.recordsUpdated).toBe(2);
    expect(run.recordsRejected).toBe(1);
  });

  it('can fail with a concise error message', () => {
    const run = createBatchRun();

    run.markFailed('Source file unavailable', finishedAt);

    expect(run.status).toBe(BatchRunStatus.FAILED);
    expect(run.errorMessage).toBe('Source file unavailable');
    expect(run.finishedAt).toEqual(finishedAt);
  });
});
