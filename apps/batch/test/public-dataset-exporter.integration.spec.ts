import {
  CandidateAsset,
  Candidacy,
  Election,
  ElectionType,
  Office,
  OfficeScope,
  Party,
  Person,
  initializeDatabase,
} from '@eleja/database';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PublicDatasetExporter } from '../src/export/public-dataset-exporter.js';

describe('PublicDatasetExporter', () => {
  let orm: Awaited<ReturnType<typeof initializeDatabase>>;
  let fixture: Awaited<ReturnType<typeof createFixture>>;
  let directory: string;

  beforeAll(async () => {
    orm = await initializeDatabase();
    fixture = await createFixture(orm);
    directory = await mkdtemp(join(tmpdir(), 'eleja-datasets-'));
  });

  afterAll(async () => {
    await fixture.cleanup();
    await orm.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('exports canonical related datasets deterministically in bounded batches', async () => {
    const exporter = new PublicDatasetExporter(orm, 1);
    const first = await exporter.export(fixture.year, directory, {
      version: '9999-01-01',
      status: 'READY',
      expectedRows: { candidates: 2, assets: 2 },
    });
    const firstCandidates = await readFile(join(directory, 'candidates.csv'));
    const firstAssets = await readFile(join(directory, 'candidate-assets.csv'));
    const second = await exporter.export(fixture.year, directory, {
      version: '9999-01-01',
      status: 'READY',
      expectedRows: { candidates: 2, assets: 2 },
    });
    const secondCandidates = await readFile(join(directory, 'candidates.csv'));
    const secondAssets = await readFile(
      join(directory, 'candidate-assets.csv'),
    );

    expect(secondCandidates).toEqual(firstCandidates);
    expect(secondAssets).toEqual(firstAssets);
    expect(second.datasets.map((dataset) => dataset.checksum)).toEqual(
      first.datasets.map((dataset) => dataset.checksum),
    );
    expect(first.datasets.map((dataset) => dataset.rows)).toEqual([2, 2]);

    const candidates = parse(firstCandidates, { columns: true }) as Record<
      string,
      string
    >[];
    const assets = parse(firstAssets, { columns: true }) as Record<
      string,
      string
    >[];
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      candidate_id: fixture.firstCandidateId,
      source_candidate_id: fixture.firstSourceId,
      name: 'João da Silva',
      city: '',
      birth_date: '1985-04-17',
      occupation: "'=SUM(A1:A2)",
    });
    expect(assets).toEqual([
      expect.objectContaining({
        candidate_id: fixture.firstCandidateId,
        source_sequence: '1',
        description: 'Apartamento "Residencial", Centro',
        declared_value: '550000.20',
      }),
      expect.objectContaining({
        candidate_id: fixture.firstCandidateId,
        source_sequence: '2',
        description: '',
        declared_value: '0.10',
      }),
    ]);
    const candidateIds = new Set(candidates.map((row) => row.candidate_id));
    expect(assets.every((row) => candidateIds.has(row.candidate_id))).toBe(
      true,
    );

    const metadata = JSON.parse(
      await readFile(join(directory, 'metadata.json'), 'utf8'),
    );
    expect(metadata).toMatchObject({
      year: fixture.year,
      version: '9999-01-01',
      status: 'READY',
      datasets: [
        { file: 'candidates.csv', rows: 2 },
        { file: 'candidate-assets.csv', rows: 2 },
      ],
    });
    expect(JSON.stringify(metadata)).not.toContain(directory);
  });
});

async function createFixture(
  orm: Awaited<ReturnType<typeof initializeDatabase>>,
) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
  const year = 9999;
  const em = orm.em.fork();
  const election = new Election(year, ElectionType.MUNICIPAL, 2);
  const party = new Party(`Partido ${suffix}`, `P${suffix}`, null, suffix);
  const officeA = new Office(
    `A_${suffix}`,
    'Cargo A',
    OfficeScope.MUNICIPAL,
    `a-${suffix}`,
  );
  const officeB = new Office(
    `B_${suffix}`,
    'Cargo B',
    OfficeScope.MUNICIPAL,
    `b-${suffix}`,
  );
  const firstPerson = new Person(
    'João da Silva',
    '1985-04-17',
    null,
    'Educação Superior',
    '=SUM(A1:A2)',
  );
  const secondPerson = new Person('Ana Teste');
  const firstSourceId = `candidate-a-${suffix}`;
  const first = new Candidacy(firstPerson, election, party, officeA, 'ALFA', {
    sourceCandidateId: firstSourceId,
    state: 'SP',
  });
  const second = new Candidacy(secondPerson, election, party, officeB, 'BETA', {
    sourceCandidateId: `candidate-b-${suffix}`,
    state: 'SP',
  });
  const assets = [
    new CandidateAsset(
      first,
      1,
      '01',
      'Imóvel',
      'Apartamento "Residencial", Centro',
      '550000.20',
    ),
    new CandidateAsset(first, 2, '02', 'Aplicação', null, '0.10'),
  ];
  em.persist([
    election,
    party,
    officeA,
    officeB,
    firstPerson,
    secondPerson,
    first,
    second,
    ...assets,
  ]);
  await em.flush();
  return {
    year,
    firstCandidateId: first.id,
    firstSourceId,
    async cleanup() {
      const clean = orm.em.fork();
      await clean.nativeDelete(CandidateAsset, {
        id: { $in: assets.map((asset) => asset.id) },
      });
      await clean.nativeDelete(Candidacy, {
        id: { $in: [first.id, second.id] },
      });
      await clean.nativeDelete(Person, {
        id: { $in: [firstPerson.id, secondPerson.id] },
      });
      await clean.nativeDelete(Election, { id: election.id });
      await clean.nativeDelete(Party, { id: party.id });
      await clean.nativeDelete(Office, {
        id: { $in: [officeA.id, officeB.id] },
      });
    },
  };
}
