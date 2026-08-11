import {
  Candidacy,
  Election,
  ElectionType,
  LegislativeBody,
  LegislativeMandate,
  LegislativeProposal,
  LegislativeProposalAuthor,
  LegislativeSource,
  LegislativeVote,
  LegislativeVotePosition,
  LegislativeVoting,
  LegislativeVotingResult,
  Office,
  OfficeScope,
  ParliamentaryExpense,
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

describe('Candidate legislative REST API', () => {
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
  it('returns profile counts, exact expense total and latest active mandate', async () => {
    const response = await request(app.getHttpServer())
      .get(`/candidates/${fixture.candidateId}/legislative-profile`)
      .expect(200);
    expect(response.body).toMatchObject({
      candidateId: fixture.candidateId,
      hasLegislativeHistory: true,
      summary: {
        mandates: 2,
        proposals: 2,
        primaryAuthoredProposals: 1,
        votes: 2,
        expenses: { count: 2, totalNetValue: '1200.50' },
      },
      currentOrLatestMandate: { legislatureNumber: 57, status: 'ACTIVE' },
    });
  });
  it('returns empty history for a known candidate and errors for invalid candidates', async () => {
    await request(app.getHttpServer())
      .get(`/candidates/${fixture.emptyId}/legislative-profile`)
      .expect(200)
      .expect({
        candidateId: fixture.emptyId,
        hasLegislativeHistory: false,
        summary: {
          mandates: 0,
          proposals: 0,
          primaryAuthoredProposals: 0,
          votes: 0,
          expenses: { count: 0, totalNetValue: '0.00' },
        },
        currentOrLatestMandate: null,
      });
    await request(app.getHttpServer())
      .get(`/candidates/${randomUUID()}/mandates`)
      .expect(404);
    await request(app.getHttpServer())
      .get('/candidates/bad/mandates')
      .expect(400);
  });
  it('orders mandates and shares person history across candidacies', async () => {
    const first = await request(app.getHttpServer())
      .get(`/candidates/${fixture.candidateId}/mandates`)
      .expect(200);
    const second = await request(app.getHttpServer())
      .get(`/candidates/${fixture.samePersonCandidateId}/mandates`)
      .expect(200);
    expect(
      first.body.map(
        (item: { legislatureNumber: number }) => item.legislatureNumber,
      ),
    ).toEqual([57, 56]);
    expect(second.body).toEqual(first.body);
  });
  it('paginates and composes proposal filters with candidate isolation', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/candidates/${fixture.candidateId}/proposals?type=PL&year=2025&primaryAuthor=true&limit=1`,
      )
      .expect(200);
    expect(response.body.meta).toEqual({
      page: 1,
      limit: 1,
      total: 1,
      totalPages: 1,
    });
    expect(response.body.data[0]).toMatchObject({
      type: 'PL',
      authorship: { isPrimaryAuthor: true },
      mandate: { legislatureNumber: 57 },
    });
    const isolated = await request(app.getHttpServer())
      .get(`/candidates/${fixture.emptyId}/proposals`)
      .expect(200);
    expect(isolated.body.meta.total).toBe(0);
  });
  it('filters votes and preserves nullable relations and official position', async () => {
    const yes = await request(app.getHttpServer())
      .get(`/candidates/${fixture.candidateId}/votes?year=2025&position=YES`)
      .expect(200);
    expect(yes.body.meta.total).toBe(1);
    expect(yes.body.data[0]).toMatchObject({
      position: 'YES',
      sourcePosition: 'Sim',
      proposal: { type: 'PL' },
    });
    const no = await request(app.getHttpServer())
      .get(`/candidates/${fixture.candidateId}/votes?position=NO`)
      .expect(200);
    expect(no.body.data[0]).toMatchObject({ proposal: null, mandate: null });
    expect(
      (
        await request(app.getHttpServer()).get(
          `/candidates/${fixture.emptyId}/votes`,
        )
      ).body.meta.total,
    ).toBe(0);
  });
  it('filters expenses with exact filtered PostgreSQL totals', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/candidates/${fixture.candidateId}/expenses?year=2025&month=5&category=COMBUST%C3%8DVEIS`,
      )
      .expect(200);
    expect(response.body.meta.total).toBe(1);
    expect(response.body.summary.totalNetValue).toBe('1200.40');
    expect(response.body.data[0]).toMatchObject({
      grossValue: '1250.40',
      deductionValue: '50.00',
      netValue: '1200.40',
    });
    expect(
      (
        await request(app.getHttpServer()).get(
          `/candidates/${fixture.emptyId}/expenses`,
        )
      ).body.meta.total,
    ).toBe(0);
  });
  it.each([
    'proposals?page=0',
    'proposals?limit=0',
    'proposals?limit=1000',
    'proposals?year=abc',
    'proposals?primaryAuthor=yes',
    'votes?position=MAYBE',
    'expenses?month=0',
    'expenses?month=13',
  ])('rejects invalid query on %s', async (path) => {
    await request(app.getHttpServer())
      .get(`/candidates/${fixture.candidateId}/${path}`)
      .expect(400);
  });
});

async function createFixture() {
  const orm = await initializeDatabase();
  const em = orm.em.fork();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
  const year = 7000 + Math.floor(Math.random() * 1000);
  const election = new Election(year, ElectionType.GENERAL, 1);
  const party = new Party(`Partido ${suffix}`, `L${suffix}`);
  const office = new Office(
    `LEG_${suffix}`,
    `Cargo ${suffix}`,
    OfficeScope.STATE,
  );
  const person = new Person(`Pessoa ${suffix}`);
  const empty = new Person(`Sem histórico ${suffix}`);
  const candidate = new Candidacy(
    person,
    election,
    party,
    office,
    `LEG ${suffix}`,
    { sourceCandidateId: `leg-${suffix}` },
  );
  const same = new Candidacy(
    person,
    election,
    party,
    office,
    `SAME ${suffix}`,
    { sourceCandidateId: `same-${suffix}` },
  );
  const emptyCandidate = new Candidacy(
    empty,
    election,
    party,
    office,
    `EMPTY ${suffix}`,
    { sourceCandidateId: `empty-${suffix}` },
  );
  const oldMandate = new LegislativeMandate(
    person,
    LegislativeBody.CHAMBER_OF_DEPUTIES,
    { legislatureNumber: 56, startedAt: '2019-02-01', endedAt: '2023-01-31' },
  );
  const mandate = new LegislativeMandate(
    person,
    LegislativeBody.CHAMBER_OF_DEPUTIES,
    {
      legislatureNumber: 57,
      startedAt: '2023-02-01',
      status: 'ACTIVE' as never,
    },
  );
  const proposalA = new LegislativeProposal(
    LegislativeSource.CAMARA,
    `PA-${suffix}`,
    'PL',
    { number: 10, year: 2025, summary: 'Proposta A' },
  );
  const proposalB = new LegislativeProposal(
    LegislativeSource.CAMARA,
    `PB-${suffix}`,
    'PEC',
    { number: 2, year: 2024 },
  );
  const authors = [
    new LegislativeProposalAuthor(proposalA, person, {
      mandate,
      isPrimaryAuthor: true,
      sourceAuthorOrder: 1,
    }),
    new LegislativeProposalAuthor(proposalB, person, {
      isPrimaryAuthor: false,
    }),
  ];
  const votingA = new LegislativeVoting(
    LegislativeSource.CAMARA,
    `VA-${suffix}`,
    new Date('2025-05-10T12:00:00Z'),
    'https://camara/vote-a',
    { proposal: proposalA, result: LegislativeVotingResult.APPROVED },
  );
  const votingB = new LegislativeVoting(
    LegislativeSource.CAMARA,
    `VB-${suffix}`,
    new Date('2024-01-10T12:00:00Z'),
    'https://camara/vote-b',
  );
  const votes = [
    new LegislativeVote(votingA, person, LegislativeVotePosition.YES, 'Sim', {
      mandate,
      votedAt: new Date('2025-05-10T12:01:00Z'),
    }),
    new LegislativeVote(votingB, person, LegislativeVotePosition.NO, 'Não'),
  ];
  const expenses = [
    new ParliamentaryExpense(
      person,
      LegislativeSource.CAMARA,
      `EA-${suffix}`,
      2025,
      5,
      'COMBUSTÍVEIS',
      '1250.40',
      '1200.40',
      '50.00',
      { mandate, documentDate: '2025-05-02' },
    ),
    new ParliamentaryExpense(
      person,
      LegislativeSource.CAMARA,
      `EB-${suffix}`,
      2024,
      4,
      'PASSAGENS',
      '0.10',
      '0.10',
      '0.00',
    ),
  ];
  em.persist([
    election,
    party,
    office,
    person,
    empty,
    candidate,
    same,
    emptyCandidate,
    oldMandate,
    mandate,
    proposalA,
    proposalB,
    ...authors,
    votingA,
    votingB,
    ...votes,
    ...expenses,
  ]);
  await em.flush();
  return {
    candidateId: candidate.id,
    samePersonCandidateId: same.id,
    emptyId: emptyCandidate.id,
    cleanup: async () => {
      const clean = orm.em.fork();
      await clean.nativeDelete(ParliamentaryExpense, { person });
      await clean.nativeDelete(LegislativeVote, { person });
      await clean.nativeDelete(LegislativeVoting, {
        id: { $in: [votingA.id, votingB.id] },
      });
      await clean.nativeDelete(LegislativeProposalAuthor, { person });
      await clean.nativeDelete(LegislativeProposal, {
        id: { $in: [proposalA.id, proposalB.id] },
      });
      await clean.nativeDelete(LegislativeMandate, { person });
      await clean.nativeDelete(Candidacy, {
        id: { $in: [candidate.id, same.id, emptyCandidate.id] },
      });
      await clean.nativeDelete(Person, { id: { $in: [person.id, empty.id] } });
      await clean.nativeDelete(Election, election.id);
      await clean.nativeDelete(Party, party.id);
      await clean.nativeDelete(Office, office.id);
      await orm.close();
    },
  };
}
