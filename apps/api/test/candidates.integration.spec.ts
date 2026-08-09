import {
  CandidateAsset,
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
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('Candidate REST API', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof createFixture>>;

  beforeAll(async () => {
    fixture = await createFixture();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await fixture?.cleanup();
  });

  it('returns deterministic default and custom pagination', async () => {
    const first = await request(app.getHttpServer())
      .get(`/candidates?year=${fixture.year}`)
      .expect(200);
    expect(first.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
    });
    expect(
      first.body.data.map((item: { ballotName: string }) => item.ballotName),
    ).toEqual(['ALFA', 'BETA', 'GAMA']);
    const second = await request(app.getHttpServer())
      .get(`/candidates?year=${fixture.year}&page=2&limit=2`)
      .expect(200);
    expect(second.body.meta).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(second.body.data).toHaveLength(1);
  });

  it('returns an empty page without treating it as not found', async () => {
    const response = await request(app.getHttpServer())
      .get('/candidates?year=1999')
      .expect(200);
    expect(response.body).toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it.each([
    ['state', 'sp', 2],
    ['name', 'maria', 1],
    ['name', 'gama', 1],
  ])('filters by %s', async (field, value, total) => {
    const response = await request(app.getHttpServer())
      .get(
        `/candidates?year=${fixture.year}&${field}=${encodeURIComponent(value)}`,
      )
      .expect(200);
    expect(response.body.meta.total).toBe(total);
  });

  it('filters by canonical office and party acronym', async () => {
    const office = await request(app.getHttpServer())
      .get(
        `/candidates?year=${fixture.year}&office=${fixture.officeCode.toLowerCase()}`,
      )
      .expect(200);
    expect(office.body.meta.total).toBe(2);
    const party = await request(app.getHttpServer())
      .get(
        `/candidates?year=${fixture.year}&party=${fixture.partyAcronym.toLowerCase()}`,
      )
      .expect(200);
    expect(party.body.meta.total).toBe(2);
  });

  it('composes filters with AND semantics', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/candidates?year=${fixture.year}&state=SP&office=${fixture.officeCode}&party=${fixture.partyAcronym}`,
      )
      .expect(200);
    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].ballotName).toBe('ALFA');
  });

  it.each([
    'page=0',
    'page=-1',
    'limit=0',
    'limit=999999',
    'year=abc',
    'state=XX',
  ])('rejects malformed query %s', async (query) => {
    await request(app.getHttpServer()).get(`/candidates?${query}`).expect(400);
  });

  it('returns an explicit detail DTO', async () => {
    const response = await request(app.getHttpServer())
      .get(`/candidates/${fixture.detailId}`)
      .expect(200);
    expect(response.body).toMatchObject({
      id: fixture.detailId,
      person: { name: 'MARIA TESTE', birthDate: '1980-01-02' },
      candidacy: { ballotName: 'ALFA', status: 'ACTIVE' },
      party: { acronym: fixture.partyAcronym },
      office: { code: fixture.officeCode },
      election: { year: fixture.year },
    });
    expect(response.body).not.toHaveProperty('createdAt');
    expect(response.body).not.toHaveProperty('assets');
  });

  it('returns 404 for an unknown UUID and 400 for a malformed UUID', async () => {
    await request(app.getHttpServer())
      .get(`/candidates/${randomUUID()}`)
      .expect(404);
    await request(app.getHttpServer())
      .get('/candidates/not-a-uuid')
      .expect(400);
  });

  it('returns all assets with exact PostgreSQL summary and deterministic ordering', async () => {
    const response = await request(app.getHttpServer())
      .get(`/candidates/${fixture.detailId}/assets`)
      .expect(200);
    expect(response.body).toEqual({
      candidateId: fixture.detailId,
      summary: {
        totalAssets: 3,
        totalDeclaredValue: '1000000000.29',
      },
      data: [
        expect.objectContaining({ value: '999999999.99' }),
        expect.objectContaining({ value: '0.20' }),
        expect.objectContaining({ value: '0.10' }),
      ],
    });
    expect(response.body.data[0]).not.toHaveProperty('candidacy');
    expect(response.body.data[0]).not.toHaveProperty('sources');
  });

  it('returns one asset and an exact summary', async () => {
    const response = await request(app.getHttpServer())
      .get(`/candidates/${fixture.singleAssetCandidateId}/assets`)
      .expect(200);
    expect(response.body.summary).toEqual({
      totalAssets: 1,
      totalDeclaredValue: '-10.25',
    });
    expect(response.body.data).toHaveLength(1);
  });

  it('distinguishes a candidate without assets from an unknown candidate', async () => {
    await request(app.getHttpServer())
      .get(`/candidates/${fixture.noAssetsCandidateId}/assets`)
      .expect(200)
      .expect({
        candidateId: fixture.noAssetsCandidateId,
        summary: { totalAssets: 0, totalDeclaredValue: '0.00' },
        data: [],
      });
    await request(app.getHttpServer())
      .get(`/candidates/${randomUUID()}/assets`)
      .expect(404);
    await request(app.getHttpServer())
      .get('/candidates/not-a-uuid/assets')
      .expect(400);
  });
});

async function createFixture() {
  const orm = await initializeDatabase();
  const em = orm.em.fork();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  const year = 9200 + Math.floor(Math.random() * 500);
  const election = new Election(year, ElectionType.GENERAL, 1);
  const partyA = new Party(
    `Partido A ${suffix}`,
    `A${suffix}`,
    null,
    `party-a-${suffix}`,
  );
  const partyB = new Party(
    `Partido B ${suffix}`,
    `B${suffix}`,
    null,
    `party-b-${suffix}`,
  );
  const officeCode = `GOV_${suffix}`;
  const governor = new Office(
    officeCode,
    'Governador',
    OfficeScope.STATE,
    `gov-${suffix}`,
  );
  const senator = new Office(
    `SEN_${suffix}`,
    'Senador',
    OfficeScope.STATE,
    `sen-${suffix}`,
  );
  senator.code = `SENATOR_${suffix}`;
  const maria = new Person('MARIA TESTE', '1980-01-02');
  const joao = new Person('JOAO TESTE', '1981-01-02');
  const ana = new Person('ANA TESTE', '1982-01-02');
  const alfa = new Candidacy(maria, election, partyA, governor, 'ALFA', {
    sourceCandidateId: `candidate-a-${suffix}`,
    state: 'SP',
    status: CandidacyStatus.ACTIVE,
  });
  const beta = new Candidacy(joao, election, partyA, governor, 'BETA', {
    sourceCandidateId: `candidate-b-${suffix}`,
    state: 'RJ',
  });
  const gama = new Candidacy(ana, election, partyB, senator, 'GAMA', {
    sourceCandidateId: `candidate-c-${suffix}`,
    state: 'SP',
  });
  const assets = [
    new CandidateAsset(alfa, 1, '01', 'Aplicação', 'Centavos A', '0.10'),
    new CandidateAsset(alfa, 2, '01', 'Aplicação', 'Centavos B', '0.20'),
    new CandidateAsset(
      alfa,
      3,
      '01',
      'Aplicação',
      'Valor elevado',
      '999999999.99',
    ),
    new CandidateAsset(beta, 1, '02', 'Conta', null, '-10.25'),
  ];
  em.persist([
    election,
    partyA,
    partyB,
    governor,
    senator,
    maria,
    joao,
    ana,
    alfa,
    beta,
    gama,
    ...assets,
  ]);
  await em.flush();
  return {
    year,
    partyAcronym: partyA.acronym,
    officeCode,
    detailId: alfa.id,
    singleAssetCandidateId: beta.id,
    noAssetsCandidateId: gama.id,
    async cleanup() {
      const clean = orm.em.fork();
      await clean.nativeDelete(CandidateAsset, {
        id: { $in: assets.map((asset) => asset.id) },
      });
      await clean.nativeDelete(Candidacy, {
        id: { $in: [alfa.id, beta.id, gama.id] },
      });
      await clean.nativeDelete(Person, {
        id: { $in: [maria.id, joao.id, ana.id] },
      });
      await clean.nativeDelete(Election, { id: election.id });
      await clean.nativeDelete(Party, { id: { $in: [partyA.id, partyB.id] } });
      await clean.nativeDelete(Office, {
        id: { $in: [governor.id, senator.id] },
      });
      await orm.close();
    },
  };
}
