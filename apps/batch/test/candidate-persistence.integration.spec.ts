import {
  CandidateSource,
  CandidateSourceType,
  Candidacy,
  CandidacyStatus,
  Election,
  ElectionType,
  LegislativeBody,
  LegislativeMandate,
  LegislativeMandateStatus,
  Office,
  OfficeScope,
  Party,
  Person,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
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
    const service = new CandidatePersistenceService(orm, fixture.context);
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
    const service = new CandidatePersistenceService(orm, fixture.context);
    const data = fixture.data('idempotent');

    try {
      await expect(service.persist(data)).resolves.toMatchObject({
        status: 'INSERTED',
        sourceStatus: 'INSERTED',
      });
      await expect(service.persist(data)).resolves.toMatchObject({
        status: 'UNCHANGED',
        sourceStatus: 'UNCHANGED',
      });
      await expect(
        orm.em.fork().count(Candidacy, {
          sourceCandidateId: fixture.sourceId('idempotent'),
        }),
      ).resolves.toBe(1);
      await expect(
        orm.em.fork().count(CandidateSource, {
          sourceIdentifier: fixture.sourceId('idempotent'),
        }),
      ).resolves.toBe(1);
    } finally {
      await fixture.cleanup(orm);
    }
  });

  it('keeps different RAW snapshots as historical source observations', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm);
    const data = fixture.data('history');
    const secondContext = {
      ...fixture.context,
      rawChecksum: 'b'.repeat(64),
      rawStorageKey: `tse/${fixture.year}/candidates/${'b'.repeat(64)}/candidates.zip`,
      importedAt: new Date('2026-08-09T12:00:00.000Z'),
    };

    try {
      await expect(
        service.persist(data, fixture.context),
      ).resolves.toMatchObject({ sourceStatus: 'INSERTED' });
      await expect(service.persist(data, secondContext)).resolves.toMatchObject(
        { status: 'UNCHANGED', sourceStatus: 'INSERTED' },
      );
      await expect(
        orm.em.fork().count(CandidateSource, {
          sourceIdentifier: fixture.sourceId('history'),
        }),
      ).resolves.toBe(2);
    } finally {
      await fixture.cleanup(orm);
    }
  });

  it('stores one source observation per candidacy for a shared snapshot', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm, fixture.context);

    try {
      await service.persist(fixture.data('snapshot-a'));
      await service.persist(fixture.data('snapshot-b'));
      await expect(
        orm.em.fork().count(CandidateSource, {
          rawChecksum: fixture.context.rawChecksum,
          sourceIdentifier: {
            $in: [
              fixture.sourceId('snapshot-a'),
              fixture.sourceId('snapshot-b'),
            ],
          },
        }),
      ).resolves.toBe(2);
    } finally {
      await fixture.cleanup(orm);
    }
  });

  it('rolls back canonical data when provenance cannot be persisted', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm);
    const data = fixture.data('atomic');

    try {
      await expect(
        service.persist(data, {
          ...fixture.context,
          rawStorageKey: '/Users/developer/private/raw.zip',
        }),
      ).rejects.toThrow('Candidate source RAW storage key must be relative');
      await expect(
        orm.em.fork().count(Candidacy, {
          sourceCandidateId: fixture.sourceId('atomic'),
        }),
      ).resolves.toBe(0);
    } finally {
      await fixture.cleanup(orm);
    }
  });

  it('updates mutable candidacy data without replacing relationships', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm, fixture.context);
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
    const service = new CandidatePersistenceService(orm, fixture.context);

    try {
      const first = await service.persist(
        fixture.data('person-a', {
          person: {
            name: 'MARIA DA SILVA',
            birthDate: '1985-05-10',
            birthState: 'SP',
            gender: 'FEMININO',
          },
        }),
      );
      const sameIdentity = await service.persist(
        fixture.data('person-b', {
          election: { year: fixture.year + 100 },
          person: {
            name: 'MARIA DA SILVA',
            birthDate: '1985-05-10',
            birthState: 'SP',
            gender: 'FEMININO',
          },
        }),
      );
      const differentBirthDate = await service.persist(
        fixture.data('person-c', {
          election: { year: fixture.year + 200 },
          person: {
            name: 'MARIA DA SILVA',
            birthDate: '1986-05-10',
            birthState: 'SP',
            gender: 'FEMININO',
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
    } finally {
      await fixture.cleanup(orm);
    }
  });

  it('does not merge exact identity collisions within the same election', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm, fixture.context);
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
    const service = new CandidatePersistenceService(orm, fixture.context);

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

  it('reuses one person across elections by stable TSE identity despite candidacy changes', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm, fixture.context);
    const identity = {
      birthState: 'SP',
      tseCpfFingerprint: 'a'.repeat(64),
    };

    try {
      const first = await service.persist(
        fixture.data('stable-2018', {
          election: { year: fixture.year },
          person: identity,
          candidacy: { ballotName: 'NOME DE URNA ANTIGO' },
        }),
      );
      const second = await service.persist(
        fixture.data('stable-2022', {
          election: { year: fixture.year + 4 },
          person: identity,
          candidacy: { ballotName: 'NOVO NOME DE URNA' },
          party: {
            name: `PARTIDO ALTERADO ${fixture.officeCode}`,
            acronym: `A${fixture.officeCode}`,
          },
          office: {
            sourceCode: `changed-${fixture.officeCode}`,
            code: `${fixture.officeCode}_CHANGED`,
            name: `Cargo alterado ${fixture.officeCode}`,
          },
        }),
      );
      if (first.status === 'REJECTED' || second.status === 'REJECTED') {
        throw new Error('Expected persisted candidacies');
      }

      expect(first.identityMatchMethod).toBe('NEW_PERSON');
      expect(second.identityMatchMethod).toBe('EXACT_EXTERNAL_IDENTIFIER');
      expect(second.person.id).toBe(first.person.id);
      await expect(
        orm.em.fork().count(Candidacy, { person: first.person.id }),
      ).resolves.toBe(2);
    } finally {
      await fixture.cleanup(orm);
      await orm.em.fork().nativeDelete(Office, {
        code: `${fixture.officeCode}_CHANGED`,
      });
    }
  });

  it('does not merge the same name when stable TSE identifiers differ', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm, fixture.context);
    const base = { birthState: 'SP' };

    try {
      const first = await service.persist(
        fixture.data('different-id-a', {
          person: { ...base, tseCpfFingerprint: 'b'.repeat(64) },
        }),
      );
      const second = await service.persist(
        fixture.data('different-id-b', {
          election: { year: fixture.year + 4 },
          person: { ...base, tseCpfFingerprint: 'c'.repeat(64) },
        }),
      );
      if (first.status === 'REJECTED' || second.status === 'REJECTED') {
        throw new Error('Expected persisted candidacies');
      }
      expect(second.person.id).not.toBe(first.person.id);
      expect(second.identityMatchMethod).toBe('NEW_PERSON');
    } finally {
      await fixture.cleanup(orm);
    }
  });

  it('uses only a complete unambiguous strong composite fallback', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm, fixture.context);
    const person = {
      name: '  MARIA   DE ÁVILA ',
      birthDate: '1988-03-20',
      birthState: 'MG',
      gender: 'FEMININO',
      tseCpfFingerprint: null,
    };

    try {
      const first = await service.persist(
        fixture.data('composite-a', { person }),
      );
      const second = await service.persist(
        fixture.data('composite-b', {
          election: { year: fixture.year + 4 },
          person: { ...person, name: 'MARIA DE ÁVILA' },
        }),
      );
      if (first.status === 'REJECTED' || second.status === 'REJECTED') {
        throw new Error('Expected persisted candidacies');
      }
      expect(second.person.id).toBe(first.person.id);
      expect(second.identityMatchMethod).toBe('STRONG_COMPOSITE');
    } finally {
      await fixture.cleanup(orm);
    }
  });

  it('rejects an ambiguous strong composite instead of picking a person', async () => {
    const fixture = createFixture(nextYear++);
    const em = orm.em.fork();
    const people = [
      new Person(
        'JOÃO DA SILVA',
        '1970-01-01',
        'MASCULINO',
        null,
        null,
        undefined,
        'RJ',
      ),
      new Person(
        '  JOÃO  DA SILVA ',
        '1970-01-01',
        'MASCULINO',
        null,
        null,
        undefined,
        'RJ',
      ),
    ];
    em.persist(people);
    await em.flush();
    try {
      const result = await new CandidatePersistenceService(
        orm,
        fixture.context,
      ).persist(
        fixture.data('ambiguous', {
          person: {
            name: 'JOÃO DA SILVA',
            birthDate: '1970-01-01',
            birthState: 'RJ',
            gender: 'MASCULINO',
            tseCpfFingerprint: null,
          },
        }),
      );
      expect(result).toEqual({
        status: 'REJECTED',
        issue: expect.objectContaining({
          field: 'person',
          reason: 'ambiguous strong composite identity',
        }),
      });
    } finally {
      await fixture.cleanup(orm);
      await orm.em.fork().nativeDelete(Person, {
        id: { $in: people.map((person) => person.id) },
      });
    }
  });

  it('consolidates only an exact stable duplicate and preserves Câmara relations', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm, fixture.context);
    const historicalPerson = {
      name: 'PESSOA CANÔNICA',
      birthDate: '1977-07-07',
      birthState: 'SP',
      gender: 'FEMININO',
      tseCpfFingerprint: 'd'.repeat(64),
    };

    try {
      const historical = await service.persist(
        fixture.data('historical', { person: historicalPerson }),
      );
      const legacy = await service.persist(
        fixture.data('legacy-2026', {
          election: { year: fixture.year + 4 },
          person: {
            name: 'REGISTRO LEGADO DUPLICADO',
            birthDate: '1970-01-01',
            birthState: null,
            gender: null,
            tseCpfFingerprint: null,
          },
        }),
      );
      if (historical.status === 'REJECTED' || legacy.status === 'REJECTED') {
        throw new Error('Expected persisted candidacies');
      }
      const em = orm.em.fork();
      const legacyPerson = em.getReference(Person, legacy.person.id);
      em.persist([
        new PersonExternalIdentity(
          legacyPerson,
          PersonExternalIdentitySource.CAMARA,
          `camara-${fixture.officeCode}`,
        ),
        new LegislativeMandate(
          legacyPerson,
          LegislativeBody.CHAMBER_OF_DEPUTIES,
          {
            legislatureNumber: 98,
            status: LegislativeMandateStatus.COMPLETED,
          },
        ),
      ]);
      await em.flush();

      const consolidated = await service.persist(
        fixture.data('legacy-2026', {
          election: { year: fixture.year + 4 },
          person: historicalPerson,
        }),
      );
      if (consolidated.status === 'REJECTED') {
        throw new Error(consolidated.issue.reason);
      }
      expect(consolidated.person.id).toBe(legacy.person.id);
      const verify = orm.em.fork();
      await expect(
        verify.count(Person, {
          id: { $in: [historical.person.id, legacy.person.id] },
        }),
      ).resolves.toBe(1);
      await expect(
        verify.count(Candidacy, { person: legacy.person.id }),
      ).resolves.toBe(2);
      await expect(
        verify.count(PersonExternalIdentity, { person: legacy.person.id }),
      ).resolves.toBe(2);
      await expect(
        verify.count(LegislativeMandate, { person: legacy.person.id }),
      ).resolves.toBe(1);
    } finally {
      await fixture.cleanup(orm);
    }
  });

  it('rejects incompatible person reassignment for an existing candidacy', async () => {
    const fixture = createFixture(nextYear++);
    const service = new CandidatePersistenceService(orm, fixture.context);

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
  party?: Partial<NormalizedCandidateData['party']>;
  office?: Partial<NormalizedCandidateData['office']>;
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
    context: {
      sourceType: CandidateSourceType.TSE,
      sourceName: 'Tribunal Superior Eleitoral',
      sourceUrl: 'https://cdn.tse.jus.br/candidates.zip',
      rawStorageKey: `tse/${year}/candidates/${'a'.repeat(64)}/candidates.zip`,
      rawChecksum: 'a'.repeat(64),
      importedAt: new Date('2026-08-08T12:00:00.000Z'),
    },
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
          ...overrides.party,
        },
        office: {
          sourceCode: `source-office-${suffix}`,
          code: officeCode,
          name: `Cargo ${suffix}`,
          scope: OfficeScope.NATIONAL,
          ...overrides.office,
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
        await em.nativeDelete(CandidateSource, {
          sourceIdentifier: { $in: [...sourceIds] },
        });
        await em.nativeDelete(Candidacy, {
          sourceCandidateId: { $in: [...sourceIds] },
        });
      }
      if (personIds.length > 0) {
        await em.nativeDelete(LegislativeMandate, {
          person: { id: { $in: personIds } },
        });
        await em.nativeDelete(PersonExternalIdentity, {
          person: { id: { $in: personIds } },
        });
        await em.nativeDelete(Person, { id: { $in: personIds } });
      }
      await em.nativeDelete(Election, { year: { $in: [...electionYears] } });
      await em.nativeDelete(Party, { sourcePartyId: partySourceId });
      await em.nativeDelete(Office, { code: officeCode });
    },
  };
}
