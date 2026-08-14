import {
  CandidateAsset,
  CandidateAssetSource,
  CandidateSource,
  CandidateSourceType,
  Candidacy,
  CandidacyStatus,
  Election,
  ElectionType,
  LegislativeBody,
  LegislativeMandate,
  LegislativeMandateStatus,
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
import { CandidateAssetPersistenceService } from '../src/persistence/candidate-asset-persistence.js';
import { CandidatePersistenceService } from '../src/persistence/candidate-persistence.js';

describe('historical candidates and declared assets', () => {
  let orm: Awaited<ReturnType<typeof initializeDatabase>>;

  beforeAll(async () => {
    orm = await initializeDatabase();
  });
  afterAll(async () => {
    await orm.close();
  });

  it('persists one person, three elections, exact assets, and preserves Câmara relations', async () => {
    const suffix = randomUUID().replaceAll('-', '');
    const years = [6100, 6104, 6108];
    const fingerprint = suffix.padEnd(64, '0').slice(0, 64);
    const candidateService = new CandidatePersistenceService(orm);
    const assetService = new CandidateAssetPersistenceService(orm);
    const candidacies: Candidacy[] = [];
    let person: Person | undefined;

    try {
      for (const [index, year] of years.entries()) {
        const result = await candidateService.persist(
          candidate(year, suffix, fingerprint, index),
          candidateContext(year),
        );
        if (result.status === 'REJECTED') throw new Error(result.issue.reason);
        person ??= result.person;
        expect(result.person.id).toBe(person.id);
        candidacies.push(result.candidacy);

        if (index === 0) {
          const em = orm.em.fork();
          em.persist([
            new PersonExternalIdentity(
              em.getReference(Person, person.id),
              PersonExternalIdentitySource.CAMARA,
              `camara-${suffix}`,
            ),
            new LegislativeMandate(
              em.getReference(Person, person.id),
              LegislativeBody.CHAMBER_OF_DEPUTIES,
              {
                legislatureNumber: 99,
                state: 'SP',
                status: LegislativeMandateStatus.COMPLETED,
              },
            ),
          ]);
          await em.flush();
        }
      }

      const values = [
        ['0.01', '1000.10'],
        ['999999999.99'],
        ['20.00', '30.00'],
      ];
      for (const [index, candidacy] of candidacies.entries()) {
        for (const [sequence, value] of values[index]!.entries()) {
          const data = {
            sourceCandidateId: candidacy.sourceCandidateId!,
            asset: {
              sourceSequence: sequence + 1,
              typeCode: '99',
              type: 'Outro bem',
              description: null,
              value,
            },
          };
          await expect(
            assetService.persist(data, assetContext(years[index]!)),
          ).resolves.toMatchObject({ status: 'INSERTED' });
          await expect(
            assetService.persist(data, assetContext(years[index]!)),
          ).resolves.toMatchObject({ status: 'UNCHANGED' });
        }
      }

      const em = orm.em.fork();
      em.clear();
      const reloaded = await em.findOneOrFail(
        Person,
        { id: person!.id },
        {
          populate: [
            'candidacies.election',
            'candidacies.assets',
            'externalIdentities',
            'legislativeMandates',
          ],
        },
      );
      expect(reloaded.candidacies).toHaveLength(3);
      expect(
        reloaded.candidacies
          .getItems()
          .map((item) => item.election.year)
          .sort(),
      ).toEqual(years);
      expect(
        reloaded.candidacies
          .getItems()
          .flatMap((item) => item.assets.getItems()),
      ).toHaveLength(5);
      expect(
        reloaded.candidacies
          .getItems()
          .flatMap((item) =>
            item.assets.getItems().map((asset) => asset.value),
          ),
      ).toEqual(['0.01', '1000.10', '999999999.99', '20.00', '30.00']);
      expect(
        reloaded.externalIdentities
          .getItems()
          .map((identity) => identity.source)
          .sort(),
      ).toEqual([
        PersonExternalIdentitySource.CAMARA,
        PersonExternalIdentitySource.TSE,
      ]);
      expect(reloaded.legislativeMandates).toHaveLength(1);
    } finally {
      await cleanup(orm, suffix, years);
    }
  });

  it('does not create a fake zero asset when a historical candidacy has no asset rows', async () => {
    const suffix = randomUUID().replaceAll('-', '');
    const year = 6120;
    try {
      const result = await new CandidatePersistenceService(orm).persist(
        candidate(year, suffix, suffix.padEnd(64, '0').slice(0, 64), 0),
        candidateContext(year),
      );
      if (result.status === 'REJECTED') throw new Error(result.issue.reason);
      await expect(
        orm.em.fork().count(CandidateAsset, { candidacy: result.candidacy.id }),
      ).resolves.toBe(0);
    } finally {
      await cleanup(orm, suffix, [year]);
    }
  });
});

function candidate(
  year: number,
  suffix: string,
  fingerprint: string,
  index: number,
): NormalizedCandidateData {
  return {
    election: { year, type: ElectionType.GENERAL, round: 1 },
    party: {
      sourcePartyId: `party-${suffix}`,
      name: `Partido ${suffix}`,
      acronym: `P${suffix.slice(0, 10)}`,
      number: null,
    },
    office: {
      sourceCode: '6',
      code: 'FEDERAL_DEPUTY',
      name: 'Deputado federal',
      scope: OfficeScope.STATE,
    },
    person: {
      name: 'PESSOA HISTÓRICA',
      birthDate: '1975-06-30',
      birthState: 'SP',
      gender: 'FEMININO',
      education: null,
      occupation: null,
      tseCpfFingerprint: fingerprint,
    },
    candidacy: {
      sourceCandidateId: `${year}${suffix.slice(0, 12)}`,
      ballotName: index === 0 ? 'NOME ANTIGO' : `NOME ${index}`,
      ballotNumber: 1234,
      state: index === 2 ? 'RJ' : 'SP',
      city: null,
      photoUrl: null,
      status: CandidacyStatus.ACTIVE,
      sourceStatus: 'APTO',
    },
  };
}

function candidateContext(year: number) {
  return {
    sourceType: CandidateSourceType.TSE,
    sourceName: 'Tribunal Superior Eleitoral',
    sourceUrl: `https://cdn.tse.jus.br/consulta_cand_${year}.zip`,
    rawStorageKey: `tse/${year}/candidates/${'a'.repeat(64)}/candidates.zip`,
    rawChecksum: 'a'.repeat(64),
    importedAt: new Date('2026-08-14T12:00:00Z'),
  };
}

function assetContext(year: number) {
  return {
    ...candidateContext(year),
    sourceUrl: `https://cdn.tse.jus.br/bem_candidato_${year}.zip`,
    rawStorageKey: `tse/${year}/assets/${'b'.repeat(64)}/assets.zip`,
    rawChecksum: 'b'.repeat(64),
  };
}

async function cleanup(
  orm: Awaited<ReturnType<typeof initializeDatabase>>,
  suffix: string,
  years: number[],
) {
  const em = orm.em.fork();
  const candidacies = await em.find(Candidacy, {
    sourceCandidateId: {
      $in: years.map((year) => `${year}${suffix.slice(0, 12)}`),
    },
  });
  const people = [...new Set(candidacies.map((item) => item.person.id))];
  const assets = await em.find(CandidateAsset, {
    candidacy: { $in: candidacies },
  });
  if (assets.length)
    await em.nativeDelete(CandidateAssetSource, {
      candidateAsset: { $in: assets },
    });
  await em.nativeDelete(CandidateAsset, { candidacy: { $in: candidacies } });
  await em.nativeDelete(CandidateSource, { candidacy: { $in: candidacies } });
  await em.nativeDelete(Candidacy, {
    id: { $in: candidacies.map((item) => item.id) },
  });
  if (people.length) {
    await em.nativeDelete(LegislativeMandate, { person: { $in: people } });
    await em.nativeDelete(PersonExternalIdentity, { person: { $in: people } });
    await em.nativeDelete(Person, { id: { $in: people } });
  }
  await em.nativeDelete(Election, { year: { $in: years } });
  await em.nativeDelete(Party, { sourcePartyId: `party-${suffix}` });
}
