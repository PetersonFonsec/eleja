import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { initializeDatabase } from '../src/initialize-database.js';
import { BatchRun } from '../src/entities/batch-run.entity.js';
import { DatasetVersion } from '../src/entities/dataset-version.entity.js';

describe('dataset persistence', () => {
  let orm: Awaited<ReturnType<typeof initializeDatabase>>;

  beforeAll(async () => {
    orm = await initializeDatabase();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('persists and reloads a dataset with its batch run', async () => {
    const em = orm.em.fork();
    const version = `integration-${randomUUID()}`;
    const dataset = new DatasetVersion(version);
    const run = new BatchRun(dataset, 'TSE_CANDIDATES');
    run.recordCounters({
      recordsRead: 3,
      recordsInserted: 2,
      recordsUpdated: 0,
      recordsRejected: 1,
    });
    run.markPartial();

    try {
      em.persist(dataset);
      em.persist(run);
      await em.flush();
      em.clear();

      const reloaded = await em.findOneOrFail(
        DatasetVersion,
        { id: dataset.id },
        { populate: ['batchRuns'] },
      );
      const reloadedRun = reloaded.batchRuns.getItems()[0];

      expect(reloaded.version).toBe(version);
      expect(reloadedRun?.source).toBe('TSE_CANDIDATES');
      expect(reloadedRun?.recordsRejected).toBe(1);
    } finally {
      await em.nativeDelete(BatchRun, { id: run.id });
      await em.nativeDelete(DatasetVersion, { id: dataset.id });
    }
  });
});
