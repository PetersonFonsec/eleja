import {
  Candidacy,
  Election,
  ElectionType,
  LegislativeBody,
  LegislativeMandate,
  LegislativeProposal,
  LegislativeSource,
  LegislativeVote,
  LegislativeVotePosition,
  LegislativeVoting,
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
import { CamaraVotingImportJob } from '../src/orchestration/camara-voting-import-job.js';

describe('CamaraVotingImportJob', () => {
  let orm: Awaited<ReturnType<typeof initializeDatabase>>;
  beforeAll(async () => {
    orm = await initializeDatabase();
  });
  afterAll(async () => {
    await orm.close();
  });

  it('persists one event, final votes for linked people, proposal and unambiguous mandates idempotently', async () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
    const electionYear = 6000 + Math.floor(Math.random() * 3000);
    const election = new Election(electionYear, ElectionType.GENERAL, 1);
    const party = new Party(`Partido votos ${suffix}`, `V${suffix}`);
    const office = new Office(
      `VOTE_${suffix}`,
      `Cargo ${suffix}`,
      OfficeScope.STATE,
    );
    const people = [
      new Person(`Pessoa A ${suffix}`),
      new Person(`Pessoa B ${suffix}`),
    ];
    const candidacies = people.map(
      (person, index) =>
        new Candidacy(
          person,
          election,
          party,
          office,
          `PESSOA ${index} ${suffix}`,
          { sourceCandidateId: `vote-candidate-${index}-${suffix}` },
        ),
    );
    const identities = people.map(
      (person, index) =>
        new PersonExternalIdentity(
          person,
          PersonExternalIdentitySource.CAMARA,
          `81${index}${suffix.replace(/\D/g, '').padEnd(7, '0')}`,
        ),
    );
    const mandates = people.map(
      (person) =>
        new LegislativeMandate(person, LegislativeBody.CHAMBER_OF_DEPUTIES, {
          legislatureNumber: 57,
          startedAt: '2025-01-01',
          endedAt: '2025-12-31',
        }),
    );
    const proposalId = `91${suffix.replace(/\D/g, '').padEnd(7, '0')}`;
    const proposal = new LegislativeProposal(
      LegislativeSource.CAMARA,
      proposalId,
      'PL',
      { number: 10, year: 2025 },
    );
    const setup = orm.em.fork();
    setup.persist([
      election,
      party,
      office,
      ...people,
      ...candidacies,
      ...identities,
      ...mandates,
      proposal,
    ]);
    await setup.flush();
    const votingId = `${proposalId}-7`;
    const source = {
      fetchVotings: vi.fn(async () => [
        {
          externalId: votingId,
          sourceUrl: `https://dadosabertos.camara.leg.br/api/v2/votacoes/${votingId}`,
          date: '2025-07-01',
          registeredAt: '2025-07-01T16:14:29',
          description: 'Aprovado.',
          approval: 1 as const,
          proposalExternalId: proposalId,
        },
      ]),
      fetchVotes: vi.fn(async () => [
        {
          votingExternalId: votingId,
          deputyExternalId: identities[0]!.externalId,
          sourcePosition: 'Não',
          registeredAt: '2025-07-01T16:10:00',
        },
        {
          votingExternalId: votingId,
          deputyExternalId: identities[0]!.externalId,
          sourcePosition: 'Sim',
          registeredAt: '2025-07-01T16:14:00',
        },
        {
          votingExternalId: votingId,
          deputyExternalId: identities[1]!.externalId,
          sourcePosition: 'Não',
          registeredAt: '2025-07-01T16:13:00',
        },
        {
          votingExternalId: votingId,
          deputyExternalId: '999999999',
          sourcePosition: 'Sim',
          registeredAt: '2025-07-01T16:12:00',
        },
        {
          votingExternalId: votingId,
          deputyExternalId: null,
          sourcePosition: 'Sim',
          registeredAt: null,
        },
      ]),
    };
    try {
      const job = new CamaraVotingImportJob(orm, source);
      const first = await job.execute(electionYear);
      const second = await job.execute(electionYear);
      expect(first).toMatchObject({
        votingEventsInserted: 1,
        votesInserted: 2,
        elejaVotesResolved: 2,
        unmappedDeputies: 1,
        voteNormalizationRejected: 1,
      });
      expect(second).toMatchObject({
        votingEventsInserted: 0,
        votingEventsUnchanged: 1,
        votesInserted: 0,
        votesUnchanged: 2,
      });
      const reloaded = await orm.em
        .fork()
        .findOneOrFail(
          LegislativeVoting,
          { externalId: votingId },
          { populate: ['proposal', 'votes.person', 'votes.mandate'] },
        );
      expect(reloaded.proposal?.id).toBe(proposal.id);
      expect(reloaded.votes).toHaveLength(2);
      expect(
        reloaded.votes
          .getItems()
          .find((vote) => vote.person.id === people[0]!.id),
      ).toMatchObject({
        position: LegislativeVotePosition.YES,
        sourcePosition: 'Sim',
        votedAt: new Date('2025-07-01T16:14:00Z'),
      });
      expect(
        reloaded.votes
          .getItems()
          .every(
            (vote) =>
              vote.mandate !== null &&
              vote.mandate.person.id === vote.person.id,
          ),
      ).toBe(true);
    } finally {
      const cleanup = orm.em.fork();
      await cleanup.nativeDelete(LegislativeVote, {
        voting: { externalId: votingId },
      });
      await cleanup.nativeDelete(LegislativeVoting, { externalId: votingId });
      await cleanup.nativeDelete(LegislativeProposal, proposal.id);
      await cleanup.nativeDelete(LegislativeMandate, {
        id: { $in: mandates.map((item) => item.id) },
      });
      await cleanup.nativeDelete(PersonExternalIdentity, {
        id: { $in: identities.map((item) => item.id) },
      });
      await cleanup.nativeDelete(Candidacy, {
        id: { $in: candidacies.map((item) => item.id) },
      });
      await cleanup.nativeDelete(Person, {
        id: { $in: people.map((item) => item.id) },
      });
      await cleanup.nativeDelete(Election, election.id);
      await cleanup.nativeDelete(Party, party.id);
      await cleanup.nativeDelete(Office, office.id);
    }
  });
});
