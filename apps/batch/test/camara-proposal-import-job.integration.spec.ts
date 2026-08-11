import {
  Candidacy,
  Election,
  ElectionType,
  LegislativeBody,
  LegislativeMandate,
  LegislativeProposal,
  LegislativeProposalAuthor,
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
import { CamaraProposalImportJob } from '../src/orchestration/camara-proposal-import-job.js';

describe('CamaraProposalImportJob', () => {
  let orm: Awaited<ReturnType<typeof initializeDatabase>>;
  beforeAll(async () => {
    orm = await initializeDatabase();
  });
  afterAll(async () => {
    await orm.close();
  });

  it('imports linked authors and remains idempotent on a second run', async () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const election = new Election(2877, ElectionType.GENERAL, 1);
    const party = new Party(`Partido ${suffix}`, `P${suffix}`);
    const office = new Office(
      `OFFICE_${suffix}`,
      `Cargo ${suffix}`,
      OfficeScope.STATE,
    );
    const person = new Person(`Pessoa ${suffix}`);
    const candidacy = new Candidacy(
      person,
      election,
      party,
      office,
      `PESSOA ${suffix}`,
      {
        sourceCandidateId: `candidate-${suffix}`,
      },
    );
    const deputyId = String(
      800_000_000 + Math.floor(Math.random() * 99_999_999),
    );
    const proposalId = String(
      700_000_000 + Math.floor(Math.random() * 99_999_999),
    );
    const identity = new PersonExternalIdentity(
      person,
      PersonExternalIdentitySource.CAMARA,
      deputyId,
    );
    const mandate = new LegislativeMandate(
      person,
      LegislativeBody.CHAMBER_OF_DEPUTIES,
      {
        legislatureNumber: 57,
        startedAt: '2023-02-01',
        endedAt: '2027-01-31',
      },
    );
    const setup = orm.em.fork();
    setup.persist([
      election,
      party,
      office,
      person,
      candidacy,
      identity,
      mandate,
    ]);
    await setup.flush();

    const source = {
      fetchReferencesByDeputyId: vi.fn(async () => [
        {
          externalId: proposalId,
          sourceUrl: `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${proposalId}`,
        },
      ]),
      fetchProposal: vi.fn(async () => ({
        externalId: proposalId,
        sourceUrl: `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${proposalId}`,
        type: 'PL',
        number: 10,
        year: 2026,
        summary: 'Ementa',
        sourceStatus: 'Em tramitação',
        presentedAt: '2026-03-10',
      })),
      fetchAuthors: vi.fn(async () => [
        {
          proposalExternalId: proposalId,
          deputyExternalId: deputyId,
          authorType: 'Deputado(a)',
          sourceAuthorOrder: 1,
          isPrimaryAuthor: true,
        },
        {
          proposalExternalId: proposalId,
          deputyExternalId: '999999999',
          authorType: 'Deputado(a)',
          sourceAuthorOrder: 2,
          isPrimaryAuthor: false,
        },
      ]),
    };
    const job = new CamaraProposalImportJob(orm, source);
    try {
      const first = await job.execute(2877);
      const second = await job.execute(2877);
      expect(first).toMatchObject({
        proposalsInserted: 1,
        authorshipInserted: 1,
        authorsNotMapped: 1,
      });
      expect(second).toMatchObject({
        proposalsInserted: 0,
        proposalsUnchanged: 1,
        authorshipInserted: 0,
        authorshipUnchanged: 1,
      });
      expect(
        await orm.em
          .fork()
          .count(LegislativeProposal, { externalId: proposalId }),
      ).toBe(1);
      expect(
        await orm.em.fork().count(LegislativeProposalAuthor, {}),
      ).toBeGreaterThanOrEqual(1);
    } finally {
      const cleanup = orm.em.fork();
      const proposal = await cleanup.findOne(LegislativeProposal, {
        externalId: proposalId,
      });
      if (proposal) {
        await cleanup.nativeDelete(LegislativeProposalAuthor, { proposal });
        await cleanup.nativeDelete(LegislativeProposal, proposal.id);
      }
      await cleanup.nativeDelete(LegislativeMandate, mandate.id);
      await cleanup.nativeDelete(PersonExternalIdentity, identity.id);
      await cleanup.nativeDelete(Candidacy, candidacy.id);
      await cleanup.nativeDelete(Person, person.id);
      await cleanup.nativeDelete(Election, election.id);
      await cleanup.nativeDelete(Party, party.id);
      await cleanup.nativeDelete(Office, office.id);
    }
  });
});
