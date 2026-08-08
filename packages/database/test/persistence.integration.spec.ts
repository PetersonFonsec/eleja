import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { initializeDatabase } from '../src/initialize-database.js';
import { BatchRun } from '../src/entities/batch-run.entity.js';
import { DatasetVersion } from '../src/entities/dataset-version.entity.js';
import { Election } from '../src/entities/election.entity.js';
import { ElectionType } from '../src/entities/election-type.js';
import { Office } from '../src/entities/office.entity.js';
import { OfficeScope } from '../src/entities/office-scope.js';
import { Party } from '../src/entities/party.entity.js';

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

  it('persists and reloads electoral reference entities', async () => {
    const em = orm.em.fork();
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const election = new Election(2097, ElectionType.GENERAL, 1);
    const party = new Party(`Partido ${suffix}`, `P${suffix}`);
    const office = new Office(
      `OFFICE_${suffix}`,
      `Cargo ${suffix}`,
      OfficeScope.NATIONAL,
    );

    try {
      em.persist([election, party, office]);
      await em.flush();
      em.clear();

      const reloadedElection = await em.findOneOrFail(Election, election.id);
      const reloadedParty = await em.findOneOrFail(Party, party.id);
      const reloadedOffice = await em.findOneOrFail(Office, office.id);

      expect(reloadedElection.type).toBe(ElectionType.GENERAL);
      expect(reloadedElection.round).toBe(1);
      expect(reloadedParty.acronym).toBe(`P${suffix}`);
      expect(reloadedOffice.scope).toBe(OfficeScope.NATIONAL);
    } finally {
      const cleanup = orm.em.fork();
      await cleanup.nativeDelete(Election, { id: election.id });
      await cleanup.nativeDelete(Party, { id: party.id });
      await cleanup.nativeDelete(Office, { id: office.id });
    }
  });

  it('rejects duplicate canonical office codes', async () => {
    const code = `OFFICE_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const first = new Office(code, 'Cargo original', OfficeScope.STATE);
    const duplicate = new Office(code, 'Cargo duplicado', OfficeScope.STATE);

    try {
      const firstEm = orm.em.fork();
      firstEm.persist(first);
      await firstEm.flush();

      const duplicateEm = orm.em.fork();
      duplicateEm.persist(duplicate);
      await expect(duplicateEm.flush()).rejects.toThrow();
    } finally {
      await orm.em.fork().nativeDelete(Office, { code });
    }
  });

  it('rejects duplicate logical elections without a round', async () => {
    const first = new Election(2098, ElectionType.GENERAL);
    const duplicate = new Election(2098, ElectionType.GENERAL);

    try {
      const firstEm = orm.em.fork();
      firstEm.persist(first);
      await firstEm.flush();

      const duplicateEm = orm.em.fork();
      duplicateEm.persist(duplicate);
      await expect(duplicateEm.flush()).rejects.toThrow();
    } finally {
      await orm.em.fork().nativeDelete(Election, {
        year: 2098,
        type: ElectionType.GENERAL,
      });
    }
  });
});
