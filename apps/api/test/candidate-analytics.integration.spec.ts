import {
  CandidateAsset,
  Candidacy,
  Election,
  ElectionType,
  LegislativeBody,
  LegislativeMandate,
  LegislativeMandateStatus,
  LegislativeProposal,
  LegislativeProposalAuthor,
  LegislativeSource,
  LegislativeVote,
  LegislativeVotePosition,
  LegislativeVoting,
  Office,
  OfficeScope,
  ParliamentaryExpense,
  Party,
  Person,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import type { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CandidateAnalyticsQueryService } from '../src/modules/analytics/candidate-analytics-query.service.js';
import { AppModule } from '../src/app.module.js';

describe('candidate analytics PostgreSQL queries', () => {
  let orm: MikroORM;
  let em: EntityManager;
  let service: CandidateAnalyticsQueryService;
  let fixture: ReturnType<typeof createFixture>;
  let app: INestApplication;

  beforeAll(async () => {
    orm = await initializeDatabase();
    em = orm.em.fork();
    const existingGovernor = await em.findOne(Office, { code: 'GOVERNOR' });
    fixture = createFixture(existingGovernor ?? undefined);
    em.persist(fixture.entities);
    await em.flush();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    service = app.get(CandidateAnalyticsQueryService);
  });

  afterAll(async () => {
    if (orm) {
      await app?.close();
      await fixture.cleanup(em).catch(() => undefined);
      await orm.close();
    }
  });

  it('ranks exact declared wealth and composes all candidacy filters', async () => {
    const ranking = await service.getTopDeclaredWealthCandidates(
      {
        electionYear: fixture.year,
        officeCode: 'GOVERNOR',
        state: 'SP',
        partyAcronym: 'ANA',
      },
      10,
    );
    expect(
      ranking.map((item) => [item.ballotName, item.declaredWealth]),
    ).toEqual([
      ['BETA ANALYTICS', '1000000000.29'],
      ['ALFA ANALYTICS', '500.00'],
    ]);
    expect(ranking[0]?.assetCount).toBe(3);
    expect(ranking.some((item) => item.ballotName === 'SEM BENS')).toBe(false);
    await expect(
      service.getTopDeclaredWealthCandidates(
        { electionYear: fixture.year },
        101,
      ),
    ).rejects.toThrow('between 1 and 100');
  });

  it('uses only the latest Câmara mandate and current candidacy filters', async () => {
    const ranking = await service.getTopCandidatesByLatestMandateExpenses({
      electionYear: fixture.year,
      officeCode: 'GOVERNOR',
      state: 'SP',
    });
    expect(ranking.map((item) => item.ballotName)).toEqual([
      'BETA ANALYTICS',
      'ALFA ANALYTICS',
    ]);
    expect(ranking.map((item) => item.totalNetValue)).toEqual([
      '3000.00',
      '1000.00',
    ]);
    expect(ranking[1]?.mandate.id).toBe(fixture.latestMandate.id);
    expect(ranking[1]?.expenseCount).toBe(1);
  });

  it('returns separate historical points and omits candidacies without assets', async () => {
    const history = await service.getDeclaredWealthHistoryByPerson(
      fixture.personA.id,
    );
    expect(
      history.points.map((point) => [point.electionYear, point.declaredWealth]),
    ).toEqual([
      [2081, '100.00'],
      [2085, '200.00'],
      [fixture.year, '500.00'],
      [fixture.year, '50.00'],
    ]);
  });

  it('reports candidacy coverage while counting legislative history by person', async () => {
    const summary = await service.getElectionAnalyticsSummary({
      electionYear: fixture.year,
    });
    expect(summary).toEqual({
      candidateCount: 4,
      personCount: 3,
      candidatesWithDeclaredAssets: 3,
      personsWithLegislativeHistory: 2,
      personsWithMultipleHistoricalCandidacies: 1,
      coverage: {
        withAssets: 3,
        withHistoricalAssetSeries: 1,
        withCamaraIdentity: 1,
        withMandates: 2,
        withProposals: 1,
        withVotes: 1,
        withExpenses: 2,
      },
    });
  });

  it('does not double-count person-level legislative records', async () => {
    const summary = await service.getLegislativeAnalyticsSummary({
      electionYear: fixture.year,
    });
    expect(summary).toEqual({
      personCount: 3,
      totalMandates: 3,
      proposalAuthorshipCount: 1,
      uniqueProposalCount: 1,
      primaryAuthorshipCount: 1,
      individualVoteCount: 1,
      expenseRecordCount: 4,
      expenseTotalNetValue: '13000.00',
    });
  });

  it('exposes summary, legislative and coverage contracts with common filters', async () => {
    const query = `year=${fixture.year}&office=governor&state=sp&party=ana`;
    const summary = await request(app.getHttpServer())
      .get(`/analytics/summary?${query}`)
      .expect(200);
    expect(summary.body).toMatchObject({
      filters: {
        year: fixture.year,
        office: 'GOVERNOR',
        state: 'SP',
        party: 'ANA',
      },
      candidates: {
        total: 3,
        distinctPeople: 3,
        withDeclaredAssets: 2,
        withLegislativeHistory: 2,
      },
    });
    const legislative = await request(app.getHttpServer())
      .get(`/analytics/legislative?${query}`)
      .expect(200);
    expect(legislative.body).toMatchObject({
      peopleWithLegislativeHistory: 2,
      mandates: 3,
      proposalAuthorships: 1,
      primaryAuthorships: 1,
      uniqueProposals: 1,
      individualVotes: 1,
      parliamentaryExpenses: { count: 4, totalNetValue: '13000.00' },
    });
    const coverage = await request(app.getHttpServer())
      .get(`/analytics/coverage?year=${fixture.year}`)
      .expect(200);
    expect(coverage.body.coverage).toMatchObject({
      withAssets: 3,
      withHistoricalAssetSeries: 1,
      withCamaraIdentity: 1,
      withMandates: 2,
    });
  });

  it('exposes bounded exact rankings and empty ranking results', async () => {
    const wealth = await request(app.getHttpServer())
      .get(`/analytics/rankings/declared-wealth?year=${fixture.year}&limit=1`)
      .expect(200);
    expect(wealth.body.meta).toEqual({ limit: 1 });
    expect(wealth.body.data).toHaveLength(1);
    expect(wealth.body.data[0]).toMatchObject({
      candidateId: fixture.candidacyB.id,
      declaredWealth: '1000000000.29',
      assetCount: 3,
    });
    expect(wealth.body.data[0]).not.toHaveProperty('candidacyId');

    const expenses = await request(app.getHttpServer())
      .get(
        `/analytics/rankings/parliamentary-expenses?year=${fixture.year}&state=SP&limit=2`,
      )
      .expect(200);
    expect(
      expenses.body.data.map(
        (item: { totalNetValue: string }) => item.totalNetValue,
      ),
    ).toEqual(['3000.00', '1000.00']);
    await request(app.getHttpServer())
      .get('/analytics/rankings/declared-wealth?year=2099')
      .expect(200)
      .expect({ data: [], meta: { limit: 10 } });
  });

  it('resolves candidate-centric wealth history and preserves missing years', async () => {
    const history = await request(app.getHttpServer())
      .get(`/analytics/candidates/${fixture.candidacyA.id}/wealth-history`)
      .expect(200);
    expect(history.body).toMatchObject({
      candidateId: fixture.candidacyA.id,
      personId: fixture.personA.id,
      hasHistoricalSeries: true,
    });
    expect(
      history.body.data.map(
        (point: { electionYear: number }) => point.electionYear,
      ),
    ).toEqual([2081, 2085, fixture.year, fixture.year]);
    const onePoint = await request(app.getHttpServer())
      .get(`/analytics/candidates/${fixture.candidacyB.id}/wealth-history`)
      .expect(200);
    expect(onePoint.body.hasHistoricalSeries).toBe(false);
    expect(onePoint.body.data).toHaveLength(1);
    await request(app.getHttpServer())
      .get(`/analytics/candidates/${randomUUID()}/wealth-history`)
      .expect(404);
    await request(app.getHttpServer())
      .get('/analytics/candidates/not-a-uuid/wealth-history')
      .expect(400);
  });

  it.each([
    'summary',
    'summary?year=abc',
    `summary?year=${2091}&state=XX`,
    `summary?year=${2091}&office=INVALID`,
    `rankings/declared-wealth?year=${2091}&limit=0`,
    `rankings/parliamentary-expenses?year=${2091}&limit=101`,
  ])('rejects invalid analytics query /analytics/%s', async (path) => {
    await request(app.getHttpServer()).get(`/analytics/${path}`).expect(400);
  });
});

function createFixture(existingGovernor?: Office) {
  const year = 2091;
  const general = new Election(year, ElectionType.GENERAL);
  const municipal = new Election(year, ElectionType.MUNICIPAL);
  const historical1 = new Election(2081, ElectionType.GENERAL);
  const historical2 = new Election(2085, ElectionType.GENERAL);
  const party = new Party('PARTIDO ANALYTICS', 'ANA', 91);
  const otherParty = new Party('OUTRO ANALYTICS', 'OUT', 92);
  const governor =
    existingGovernor ?? new Office('GOVERNOR', 'Governador', OfficeScope.STATE);
  const deputy = new Office(
    'DEPUTY_ANALYTICS',
    'Deputado analytics',
    OfficeScope.STATE,
  );
  const personA = new Person('PESSOA A ANALYTICS');
  const personB = new Person('PESSOA B ANALYTICS');
  const personC = new Person('PESSOA C ANALYTICS');
  const candidacyA = new Candidacy(
    personA,
    general,
    party,
    governor,
    'ALFA ANALYTICS',
    {
      state: 'SP',
    },
  );
  const candidacyA2 = new Candidacy(
    personA,
    municipal,
    otherParty,
    deputy,
    'ALFA SEGUNDA',
    { state: 'RJ' },
  );
  const candidacyB = new Candidacy(
    personB,
    general,
    party,
    governor,
    'BETA ANALYTICS',
    {
      state: 'SP',
    },
  );
  const candidacyC = new Candidacy(
    personC,
    general,
    party,
    governor,
    'SEM BENS',
    {
      state: 'SP',
    },
  );
  const historyA1 = new Candidacy(
    personA,
    historical1,
    party,
    deputy,
    'ALFA 2081',
  );
  const historyA2 = new Candidacy(
    personA,
    historical2,
    party,
    deputy,
    'ALFA 2085',
  );
  const assets = [
    new CandidateAsset(candidacyA, 1, '1', 'Bem', null, '500.00'),
    new CandidateAsset(candidacyA2, 1, '1', 'Bem', null, '50.00'),
    new CandidateAsset(candidacyB, 1, '1', 'Bem', null, '0.10'),
    new CandidateAsset(candidacyB, 2, '1', 'Bem', null, '0.20'),
    new CandidateAsset(candidacyB, 3, '1', 'Bem', null, '999999999.99'),
    new CandidateAsset(historyA1, 1, '1', 'Bem', null, '100.00'),
    new CandidateAsset(historyA2, 1, '1', 'Bem', null, '200.00'),
  ];
  const oldMandate = new LegislativeMandate(
    personA,
    LegislativeBody.CHAMBER_OF_DEPUTIES,
    { legislatureNumber: 70, startedAt: '2070-01-01' },
  );
  const latestMandate = new LegislativeMandate(
    personA,
    LegislativeBody.CHAMBER_OF_DEPUTIES,
    {
      legislatureNumber: 71,
      startedAt: '2074-01-01',
      status: LegislativeMandateStatus.ACTIVE,
    },
  );
  const mandateB = new LegislativeMandate(
    personB,
    LegislativeBody.CHAMBER_OF_DEPUTIES,
    { legislatureNumber: 71, startedAt: '2074-01-01' },
  );
  const expenses = [
    expense(personA, oldMandate, 'old', '9000.00'),
    expense(personA, latestMandate, 'latest', '1000.00'),
    expense(personB, mandateB, 'b1', '2999.90'),
    expense(personB, mandateB, 'b2', '0.10'),
  ];
  const proposal = new LegislativeProposal(
    LegislativeSource.CAMARA,
    'analytics-proposal',
    'PL',
  );
  const authorship = new LegislativeProposalAuthor(proposal, personA, {
    mandate: latestMandate,
    isPrimaryAuthor: true,
  });
  const voting = new LegislativeVoting(
    LegislativeSource.CAMARA,
    'analytics-voting',
    new Date('2075-01-01T12:00:00Z'),
    'https://dadosabertos.camara.leg.br/',
    { proposal },
  );
  const vote = new LegislativeVote(
    voting,
    personA,
    LegislativeVotePosition.YES,
    'Sim',
    { mandate: latestMandate },
  );
  const identity = new PersonExternalIdentity(
    personA,
    PersonExternalIdentitySource.CAMARA,
    'analytics-person-a',
  );
  return {
    year,
    personA,
    candidacyA,
    candidacyB,
    latestMandate,
    cleanup: async (em: EntityManager) => {
      await em.nativeDelete(ParliamentaryExpense, {
        id: { $in: expenses.map((x) => x.id) },
      });
      await em.nativeDelete(LegislativeVote, vote.id);
      await em.nativeDelete(LegislativeVoting, voting.id);
      await em.nativeDelete(LegislativeProposalAuthor, authorship.id);
      await em.nativeDelete(LegislativeProposal, proposal.id);
      await em.nativeDelete(PersonExternalIdentity, identity.id);
      await em.nativeDelete(LegislativeMandate, {
        id: { $in: [oldMandate.id, latestMandate.id, mandateB.id] },
      });
      await em.nativeDelete(CandidateAsset, {
        id: { $in: assets.map((x) => x.id) },
      });
      await em.nativeDelete(Candidacy, {
        id: {
          $in: [
            candidacyA,
            candidacyA2,
            candidacyB,
            candidacyC,
            historyA1,
            historyA2,
          ].map((x) => x.id),
        },
      });
      await em.nativeDelete(Person, {
        id: { $in: [personA.id, personB.id, personC.id] },
      });
      await em.nativeDelete(Election, {
        id: { $in: [general.id, municipal.id, historical1.id, historical2.id] },
      });
      await em.nativeDelete(Party, { id: { $in: [party.id, otherParty.id] } });
      await em.nativeDelete(Office, deputy.id);
      if (!existingGovernor) await em.nativeDelete(Office, governor.id);
    },
    entities: [
      general,
      municipal,
      historical1,
      historical2,
      party,
      otherParty,
      ...(existingGovernor ? [] : [governor]),
      deputy,
      personA,
      personB,
      personC,
      candidacyA,
      candidacyA2,
      candidacyB,
      candidacyC,
      historyA1,
      historyA2,
      ...assets,
      oldMandate,
      latestMandate,
      mandateB,
      ...expenses,
      proposal,
      authorship,
      voting,
      vote,
      identity,
    ],
  };
}

function expense(
  person: Person,
  mandate: LegislativeMandate,
  id: string,
  value: string,
) {
  return new ParliamentaryExpense(
    person,
    LegislativeSource.CAMARA,
    `analytics-${id}`,
    2075,
    1,
    'Categoria',
    value,
    value,
    '0.00',
    { mandate },
  );
}
