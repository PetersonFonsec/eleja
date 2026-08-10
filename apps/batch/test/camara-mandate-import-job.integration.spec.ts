import {
  Candidacy,
  Election,
  ElectionType,
  LegislativeMandate,
  Office,
  OfficeScope,
  Party,
  Person,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CamaraMandateImportJob } from '../src/orchestration/camara-mandate-import-job.js';

describe('CamaraMandateImportJob', () => {
  let orm: Awaited<ReturnType<typeof initializeDatabase>>;

  beforeAll(async () => {
    orm = await initializeDatabase();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('processes linked people once and is idempotent across runs', async () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const year = 2876;
    const election = new Election(year, ElectionType.GENERAL, 1);
    const party = new Party(`Partido ${suffix}`, `P${suffix}`);
    const office = new Office(
      `OFFICE_${suffix}`,
      `Cargo ${suffix}`,
      OfficeScope.STATE,
    );
    const linked = new Person(`Pessoa vinculada ${suffix}`);
    const unlinked = new Person(`Pessoa sem vínculo ${suffix}`);
    const linkedCandidacy = new Candidacy(
      linked,
      election,
      party,
      office,
      `VINCULADA ${suffix}`,
      {
        sourceCandidateId: `linked-${suffix}`,
      },
    );
    const unlinkedCandidacy = new Candidacy(
      unlinked,
      election,
      party,
      office,
      `SEM VINCULO ${suffix}`,
      {
        sourceCandidateId: `unlinked-${suffix}`,
      },
    );
    const externalId = String(
      900_000_000 + Math.floor(Math.random() * 99_999_999),
    );
    const identity = new PersonExternalIdentity(
      linked,
      PersonExternalIdentitySource.CAMARA,
      externalId,
    );
    const setup = orm.em.fork();
    setup.persist([
      election,
      party,
      office,
      linked,
      unlinked,
      linkedCandidacy,
      unlinkedCandidacy,
      identity,
    ]);
    await setup.flush();

    const fetchByDeputyId = vi.fn(async (deputyId: string) => [
      {
        deputyExternalId: deputyId,
        legislatureNumber: 57,
        state: 'SP',
        partyAcronym: 'ABC',
        occurredAt: '2023-02-01T12:00',
        situation: 'Exercício',
        statusDescription: 'Entrada',
        legislatureStartedAt: '2023-02-01',
        legislatureEndedAt: '2027-01-31',
      },
    ]);
    const job = new CamaraMandateImportJob(orm, { fetchByDeputyId });

    try {
      const first = await job.execute(year);
      const second = await job.execute(year);
      expect(first).toMatchObject({
        peopleConsidered: 2,
        camaraIdentitiesFound: 1,
        deputiesQueried: 1,
        inserted: 1,
      });
      expect(second).toMatchObject({ inserted: 0, updated: 0, unchanged: 1 });
      expect(fetchByDeputyId).toHaveBeenCalledTimes(2);
      expect(fetchByDeputyId).toHaveBeenCalledWith(externalId);
      expect(
        await orm.em.fork().count(LegislativeMandate, { person: linked.id }),
      ).toBe(1);
      expect(
        await orm.em.fork().count(LegislativeMandate, { person: unlinked.id }),
      ).toBe(0);
    } finally {
      const cleanup = orm.em.fork();
      await cleanup.nativeDelete(LegislativeMandate, { person: linked.id });
      await cleanup.nativeDelete(PersonExternalIdentity, identity.id);
      await cleanup.nativeDelete(Candidacy, {
        id: { $in: [linkedCandidacy.id, unlinkedCandidacy.id] },
      });
      await cleanup.nativeDelete(Person, {
        id: { $in: [linked.id, unlinked.id] },
      });
      await cleanup.nativeDelete(Election, election.id);
      await cleanup.nativeDelete(Party, party.id);
      await cleanup.nativeDelete(Office, office.id);
    }
  });
});
