import {
  CandidateAsset,
  CandidateAssetSource,
  CandidateSourceType,
  Candidacy,
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
import type { NormalizedCandidateAssetData } from '../src/normalization/normalized-candidate-asset-data.js';
import { CandidateAssetPersistenceService } from '../src/persistence/candidate-asset-persistence.js';

let nextAssetYear = 9000;

describe('CandidateAssetPersistenceService', () => {
  let orm: Awaited<ReturnType<typeof initializeDatabase>>;
  beforeAll(async () => {
    orm = await initializeDatabase();
  });
  afterAll(async () => {
    await orm.close();
  });

  it('inserts, updates and preserves snapshot provenance idempotently', async () => {
    const fixture = await createFixture(orm);
    const service = new CandidateAssetPersistenceService(orm);
    try {
      await expect(
        service.persist(fixture.asset, fixture.context),
      ).resolves.toMatchObject({
        status: 'INSERTED',
        sourceStatus: 'INSERTED',
      });
      await expect(
        service.persist(fixture.asset, fixture.context),
      ).resolves.toMatchObject({
        status: 'UNCHANGED',
        sourceStatus: 'UNCHANGED',
      });
      await expect(
        service.persist(
          {
            ...fixture.asset,
            asset: {
              ...fixture.asset.asset,
              description: 'Descrição atualizada',
              value: '20.00',
            },
          },
          { ...fixture.context, importedAt: new Date('2026-08-09T00:00:00Z') },
        ),
      ).resolves.toMatchObject({ status: 'UPDATED', sourceStatus: 'UPDATED' });
      await expect(
        service.persist(fixture.asset, {
          ...fixture.context,
          rawChecksum: 'b'.repeat(64),
          rawStorageKey: `tse/2026/assets/${'b'.repeat(64)}/assets.zip`,
        }),
      ).resolves.toMatchObject({ sourceStatus: 'INSERTED' });
      await expect(
        orm.em.fork().count(CandidateAsset, { candidacy: fixture.candidacy }),
      ).resolves.toBe(1);
      await expect(
        orm.em.fork().count(CandidateAssetSource, {
          rawChecksum: { $in: ['a'.repeat(64), 'b'.repeat(64)] },
        }),
      ).resolves.toBe(2);
    } finally {
      await fixture.cleanup();
    }
  });

  it('keeps equal sequences isolated by candidacy', async () => {
    const first = await createFixture(orm);
    const second = await createFixture(orm);
    const service = new CandidateAssetPersistenceService(orm);
    try {
      await service.persist(first.asset, first.context);
      await service.persist(second.asset, second.context);
      const assets = await orm.em
        .fork()
        .find(CandidateAsset, { sourceSequence: 1 });
      expect(
        assets.filter((asset) =>
          [first.candidacy.id, second.candidacy.id].includes(
            asset.candidacy.id,
          ),
        ),
      ).toHaveLength(2);
    } finally {
      await first.cleanup();
      await second.cleanup();
    }
  });

  it('rejects an unknown candidacy without creating domain data', async () => {
    const service = new CandidateAssetPersistenceService(orm);
    const data = candidateAssetData(`missing-${randomUUID()}`);
    await expect(service.persist(data, context())).resolves.toEqual({
      status: 'REJECTED',
      code: 'CANDIDACY_NOT_FOUND',
      sourceCandidateId: data.sourceCandidateId,
    });
  });
});

async function createFixture(
  orm: Awaited<ReturnType<typeof initializeDatabase>>,
) {
  const suffix = randomUUID().slice(0, 8);
  const em = orm.em.fork();
  const election = new Election(nextAssetYear++, ElectionType.GENERAL, 1);
  const party = new Party(
    `Partido ${suffix}`,
    `P${suffix}`,
    null,
    `party-${suffix}`,
  );
  const office = new Office(
    `OFFICE_${suffix}`,
    `Cargo ${suffix}`,
    OfficeScope.NATIONAL,
    suffix,
  );
  const person = new Person(`Pessoa ${suffix}`);
  const candidacy = new Candidacy(
    person,
    election,
    party,
    office,
    `Candidato ${suffix}`,
    { sourceCandidateId: `candidate-${suffix}` },
  );
  em.persist([election, party, office, person, candidacy]);
  await em.flush();
  return {
    candidacy,
    asset: candidateAssetData(candidacy.sourceCandidateId!),
    context: context(),
    async cleanup() {
      const cleanup = orm.em.fork();
      const assets = await cleanup.find(CandidateAsset, { candidacy });
      if (assets.length)
        await cleanup.nativeDelete(CandidateAssetSource, {
          candidateAsset: { $in: assets.map((asset) => asset.id) },
        });
      await cleanup.nativeDelete(CandidateAsset, { candidacy });
      await cleanup.nativeDelete(Candidacy, { id: candidacy.id });
      await cleanup.nativeDelete(Person, { id: person.id });
      await cleanup.nativeDelete(Election, { id: election.id });
      await cleanup.nativeDelete(Party, { id: party.id });
      await cleanup.nativeDelete(Office, { id: office.id });
    },
  };
}

function candidateAssetData(
  sourceCandidateId: string,
): NormalizedCandidateAssetData {
  return {
    sourceCandidateId,
    asset: {
      sourceSequence: 1,
      typeCode: '21',
      type: 'Veículo',
      description: 'Automóvel',
      value: '10.00',
    },
  };
}

function context() {
  return {
    sourceType: CandidateSourceType.TSE,
    sourceName: 'Tribunal Superior Eleitoral',
    sourceUrl: 'https://cdn.tse.jus.br/assets.zip',
    rawStorageKey: `tse/2026/assets/${'a'.repeat(64)}/assets.zip`,
    rawChecksum: 'a'.repeat(64),
    importedAt: new Date('2026-08-08T00:00:00Z'),
  };
}
