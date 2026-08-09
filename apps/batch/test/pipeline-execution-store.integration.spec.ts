import {
  BatchRun,
  BatchRunStatus,
  DatasetVersion,
  DatasetVersionStatus,
  initializeDatabase,
} from '@eleja/database';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MikroOrmPipelineExecutionStore } from '../src/orchestration/mikro-orm-pipeline-execution-store.js';

describe('MikroOrmPipelineExecutionStore', () => {
  let orm: Awaited<ReturnType<typeof initializeDatabase>>;
  const versions: string[] = [];

  beforeAll(async () => {
    orm = await initializeDatabase();
  });

  afterAll(async () => {
    const em = orm.em.fork();
    await em.nativeDelete(BatchRun, {
      datasetVersion: { version: { $in: versions } },
    });
    await em.nativeDelete(DatasetVersion, { version: { $in: versions } });
    await orm.close();
  });

  it('keeps failed attempt history when retrying the same version', async () => {
    const version = uniqueVersion();
    const store = new MikroOrmPipelineExecutionStore(orm);
    const first = await store.begin(version);
    await first.fail(new Error('first attempt failed'), counters);
    const second = await store.begin(version);
    await second.complete(counters);

    const em = orm.em.fork();
    const dataset = await em.findOneOrFail(DatasetVersion, { version });
    const runs = await em.find(
      BatchRun,
      { datasetVersion: dataset },
      { orderBy: { startedAt: 'ASC' } },
    );
    expect(dataset.status).toBe(DatasetVersionStatus.READY);
    expect(runs.map(({ status }) => status)).toEqual([
      BatchRunStatus.FAILED,
      BatchRunStatus.SUCCESS,
    ]);
  });

  it('refuses to rebuild an immutable ready version', async () => {
    const version = uniqueVersion();
    const store = new MikroOrmPipelineExecutionStore(orm);
    const attempt = await store.begin(version);
    await attempt.complete(counters);

    await expect(store.begin(version)).rejects.toThrow(
      `Dataset version ${version} is already READY`,
    );
  });

  function uniqueVersion() {
    const version = `test-${randomUUID()}`;
    versions.push(version);
    return version;
  }
});

const counters = {
  recordsRead: 10,
  recordsInserted: 7,
  recordsUpdated: 2,
  recordsRejected: 1,
};
