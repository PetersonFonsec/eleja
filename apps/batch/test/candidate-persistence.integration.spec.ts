import {
  Candidacy,
  CandidacyStatus,
  Election,
  ElectionType,
  Office,
  OfficeScope,
  Party,
  Person,
  initializeDatabase,
} from '@eleja/database';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NormalizedCandidateData } from '../src/normalization/normalized-candidate-data.js';
import { CandidatePersistenceService } from '../src/persistence/candidate-persistence.js';

describe('CandidatePersistenceService', () => {
  let orm: Awaited<ReturnType<typeof initializeDatabase>>;
  let nextYear = 7000;

  beforeAll(async () => {
    orm = await initializeDatabase();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('reuses Election, Party and Office for multiple candidates', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm);
    const firstData = fixture.data('candidate-a', {
      person: { name: 'PESSOA A', birthDate: '1980-01-01' },
    });
    const secondData = fixture.data('candidate-b', {
      person: { name: 'PESSOA B', birthDate: '1981-01-01' },
    });

    try {
      const first = await service.persist(firstData);
      const second = await service.persist(secondData);

      expect(first).toMatchObject({
        status: 'INSERTED',
        created: { election: true, party: true, office: true },
      });
      expect(second).toMatchObject({
        status: 'INSERTED',
        created: { election: false, party: false, office: false },
      });
      const em = orm.em.fork();
      await expect(em.count(Election, { year: fixture.year })).resolves.toBe(1);
      await expect(
        em.count(Party, { sourcePartyId: fixture.partySourceId }),
      ).resolves.toBe(1);
      await expect(
        em.count(Office, { code: fixture.officeCode }),
      ).resolves.toBe(1);
    } finally {
      await fixture.cleanup(orm);
    }
  });

  it('inserts then leaves the same candidacy unchanged', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm);
    const data = fixture.data('idempotent');

    try {
      await expect(service.persist(data)).resolves.toMatchObject({
        status: 'INSERTED',
      });
      await expect(service.persist(data)).resolves.toMatchObject({
        status: 'UNCHANGED',
      });
      await expect(
        orm.em.fork().count(Candidacy, {
          sourceCandidateId: fixture.sourceId('idempotent'),
        }),
      ).resolves.toBe(1);
    } finally {
      await fixture.cleanup(orm);
    }
  });

  it('updates mutable candidacy data without replacing relationships', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm);
    const initial = fixture.data('updated', {
      candidacy: { status: CandidacyStatus.ACTIVE, sourceStatus: 'APTO' },
    });
    const changed = fixture.data('updated', {
      candidacy: {
        ballotName: 'NOVO NOME DE URNA',
        status: CandidacyStatus.INACTIVE,
        sourceStatus: 'INAPTO',
      },
    });

    try {
      const inserted = await service.persist(initial);
      const updated = await service.persist(changed);

      expect(updated).toMatchObject({ status: 'UPDATED' });
      if (inserted.status === 'REJECTED' || updated.status === 'REJECTED') {
        throw new Error('Expected persisted candidacies');
      }
      expect(updated.candidacy.id).toBe(inserted.candidacy.id);
      const reloaded = await orm.em.fork().findOneOrFail(Candidacy, {
        sourceCandidateId: fixture.sourceId('updated'),
      });
      expect(reloaded.ballotName).toBe('NOVO NOME DE URNA');
      expect(reloaded.status).toBe(CandidacyStatus.INACTIVE);
      expect(reloaded.sourceStatus).toBe('INAPTO');
    } finally {
      await fixture.cleanup(orm);
    }
  });

  it('reuses exact person identity across elections and separates different birth dates', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm);

    try {
      const first = await service.persist(
        fixture.data('person-a', {
          person: {
            name: 'MARIA DA SILVA',
            birthDate: '1985-05-10',
            gender: null,
          },
        }),
      );
      const sameIdentity = await service.persist(
        fixture.data('person-b', {
          election: { year: fixture.year + 100 },
          person: {
            name: 'MARIA DA SILVA',
            birthDate: '1985-05-10',
            gender: null,
          },
        }),
      );
      const differentBirthDate = await service.persist(
        fixture.data('person-c', {
          election: { year: fixture.year + 200 },
          person: {
            name: 'MARIA DA SILVA',
            birthDate: '1986-05-10',
            gender: null,
          },
        }),
      );
      if (
        first.status === 'REJECTED' ||
        sameIdentity.status === 'REJECTED' ||
        differentBirthDate.status === 'REJECTED'
      ) {
        throw new Error('Expected persisted candidacies');
      }

      expect(sameIdentity.person.id).toBe(first.person.id);
      expect(differentBirthDate.person.id).not.toBe(first.person.id);
      await expect(
        orm.em.fork().count(Person, { name: 'MARIA DA SILVA' }),
      ).resolves.toBe(2);
    } finally {
      await fixture.cleanup(orm);
    }
  });

  it('does not merge exact identity collisions within the same election', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm);
    const person = {
      name: `COLISÃO DE IDENTIDADE ${fixture.officeCode}`,
      birthDate: '1979-11-29',
      gender: 'FEMININO',
    };

    try {
      const first = await service.persist(
        fixture.data('collision-a', { person }),
      );
      const second = await service.persist(
        fixture.data('collision-b', { person }),
      );
      if (first.status === 'REJECTED' || second.status === 'REJECTED') {
        throw new Error('Expected persisted candidacies');
      }
      expect(second.person.id).not.toBe(first.person.id);
    } finally {
      await fixture.cleanup(orm);
    }
  });

  it('does not reuse people without a birth date across candidacies', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm);

    try {
      const first = await service.persist(
        fixture.data('missing-date-a', { person: { birthDate: null } }),
      );
      const second = await service.persist(
        fixture.data('missing-date-b', { person: { birthDate: null } }),
      );
      if (first.status === 'REJECTED' || second.status === 'REJECTED') {
        throw new Error('Expected persisted candidacies');
      }
      expect(second.person.id).not.toBe(first.person.id);
    } finally {
      await fixture.cleanup(orm);
    }
  });

  it('rejects incompatible person reassignment for an existing candidacy', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm);

    try {
      await service.persist(
        fixture.data('conflict', {
          person: { name: 'PESSOA ORIGINAL', birthDate: '1970-01-01' },
        }),
      );
      const conflict = await service.persist(
        fixture.data('conflict', {
          person: { name: 'OUTRA PESSOA', birthDate: '1975-01-01' },
        }),
      );

      expect(conflict).toEqual({
        status: 'REJECTED',
        issue: {
          sourceCandidateId: fixture.sourceId('conflict'),
          field: 'person',
          reason: 'existing candidacy resolves to a different person',
        },
      });
      const reloaded = await orm.em
        .fork()
        .findOneOrFail(
          Candidacy,
          { sourceCandidateId: fixture.sourceId('conflict') },
          { populate: ['person'] },
        );
      expect(reloaded.person.name).toBe('PESSOA ORIGINAL');
    } finally {
      await fixture.cleanup(orm);
    }
  });
});

interface CandidateOverrides {
  election?: Partial<NormalizedCandidateData['election']>;
  person?: Partial<NormalizedCandidateData['person']>;
  candidacy?: Partial<NormalizedCandidateData['candidacy']>;
}

function createFixture(year: number) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const partySourceId = `party-${suffix}`;
  const officeCode = `OFFICE_${suffix}`;
  const sourceIds = new Set<string>();
  const electionYears = new Set<number>();

  return {
    year,
    partySourceId,
    officeCode,
    sourceId: (value: string) => `candidate-${suffix}-${value}`,
    data(
      value: string,
      overrides: CandidateOverrides = {},
    ): NormalizedCandidateData {
      const sourceCandidateId = `candidate-${suffix}-${value}`;
      sourceIds.add(sourceCandidateId);
      const election = {
        year,
        type: ElectionType.GENERAL,
        round: 1 as const,
        ...overrides.election,
      };
      electionYears.add(election.year);
      return {
        election,
        party: {
          sourcePartyId: partySourceId,
          name: `PARTIDO ${suffix}`,
          acronym: `P${suffix}`,
          number: null,
        },
        office: {
          sourceCode: `source-office-${suffix}`,
          code: officeCode,
          name: `Cargo ${suffix}`,
          scope: OfficeScope.NATIONAL,
        },
        person: {
          name: `PESSOA ${suffix}`,
          birthDate: '1980-01-01',
          gender: 'NÃO INFORMADO',
          education: null,
          occupation: null,
          ...overrides.person,
        },
        candidacy: {
          sourceCandidateId,
          ballotName: `CANDIDATO ${suffix}`,
          ballotNumber: 42,
          state: null,
          city: null,
          photoUrl: null,
          status: CandidacyStatus.UNKNOWN,
          sourceStatus: '#NE',
          ...overrides.candidacy,
        },
      };
    },
    async cleanup(database: Awaited<ReturnType<typeof initializeDatabase>>) {
      const em = database.em.fork();
      const candidacies = await em.find(Candidacy, {
        sourceCandidateId: { $in: [...sourceIds] },
      });
      const personIds = [...new Set(candidacies.map((item) => item.person.id))];
      if (sourceIds.size > 0) {
        await em.nativeDelete(Candidacy, {
          sourceCandidateId: { $in: [...sourceIds] },
        });
      }
      if (personIds.length > 0) {
        await em.nativeDelete(Person, { id: { $in: personIds } });
      }
      await em.nativeDelete(Election, { year: { $in: [...electionYears] } });
      await em.nativeDelete(Party, { sourcePartyId: partySourceId });
      await em.nativeDelete(Office, { code: officeCode });
    },
  };
}
