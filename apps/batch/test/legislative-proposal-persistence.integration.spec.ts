import {
  LegislativeBody,
  LegislativeMandate,
  LegislativeProposal,
  LegislativeProposalAuthor,
  LegislativeSource,
  Person,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NormalizedLegislativeProposalData } from '../src/normalization/normalized-legislative-proposal-data.js';
import { LegislativeProposalAuthorshipPersistenceService } from '../src/persistence/legislative-proposal-authorship-persistence.js';
import { LegislativeProposalPersistenceService } from '../src/persistence/legislative-proposal-persistence.js';

describe('legislative proposal persistence', () => {
  let orm: Awaited<ReturnType<typeof initializeDatabase>>;
  beforeAll(async () => {
    orm = await initializeDatabase();
  });
  afterAll(async () => {
    await orm.close();
  });

  it('inserts, reuses and updates one proposal', async () => {
    const externalId = numericId();
    const service = new LegislativeProposalPersistenceService(orm);
    try {
      const first = await service.persist(proposal(externalId));
      const second = await service.persist(proposal(externalId));
      const updated = await service.persist(
        proposal(externalId, {
          summary: 'Resumo corrigido',
          sourceStatus: 'Arquivada',
        }),
      );
      expect(first.status).toBe('INSERTED');
      expect(second.status).toBe('UNCHANGED');
      expect(updated.status).toBe('UPDATED');
      expect(updated.proposal.id).toBe(first.proposal.id);
      expect(
        await orm.em.fork().count(LegislativeProposal, { externalId }),
      ).toBe(1);
    } finally {
      await orm.em.fork().nativeDelete(LegislativeProposal, { externalId });
    }
  });

  it('persists multiple mapped authors, skips unmapped and resolves mandate safely', async () => {
    const first = await personContext();
    const second = await personContext();
    const proposalExternalId = numericId();
    const proposalResult = await new LegislativeProposalPersistenceService(
      orm,
    ).persist(proposal(proposalExternalId));
    const service = new LegislativeProposalAuthorshipPersistenceService(orm);
    try {
      const firstResult = await service.persist(
        proposalResult.proposal.id,
        author(proposalExternalId, first.externalId, 1, true),
        '2026-03-10',
      );
      const duplicate = await service.persist(
        proposalResult.proposal.id,
        author(proposalExternalId, first.externalId, 1, true),
        '2026-03-10',
      );
      const secondResult = await service.persist(
        proposalResult.proposal.id,
        author(proposalExternalId, second.externalId, 2, false),
        '2026-03-10',
      );
      const unmapped = await service.persist(
        proposalResult.proposal.id,
        author(proposalExternalId, numericId(), 3, false),
        '2026-03-10',
      );
      expect(firstResult.status).toBe('INSERTED');
      expect(duplicate.status).toBe('UNCHANGED');
      expect(secondResult.status).toBe('INSERTED');
      expect(unmapped.status).toBe('AUTHOR_NOT_MAPPED');

      const authorships = await orm.em
        .fork()
        .find(
          LegislativeProposalAuthor,
          { proposal: proposalResult.proposal.id },
          { populate: ['person', 'mandate'] },
        );
      expect(authorships).toHaveLength(2);
      expect(
        authorships.find((item) => item.person.id === first.person.id),
      ).toMatchObject({
        isPrimaryAuthor: true,
        sourceAuthorOrder: 1,
      });
      expect(authorships.every((item) => item.mandate !== null)).toBe(true);
    } finally {
      const cleanup = orm.em.fork();
      await cleanup.nativeDelete(LegislativeProposalAuthor, {
        proposal: proposalResult.proposal.id,
      });
      await cleanup.nativeDelete(
        LegislativeProposal,
        proposalResult.proposal.id,
      );
      await cleanupContext(first);
      await cleanupContext(second);
    }
  });

  async function personContext() {
    const person = new Person(`Pessoa proposta ${randomUUID()}`);
    const externalId = numericId();
    const identity = new PersonExternalIdentity(
      person,
      PersonExternalIdentitySource.CAMARA,
      externalId,
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
    const em = orm.em.fork();
    em.persist([person, identity, mandate]);
    await em.flush();
    return { person, identity, mandate, externalId };
  }

  async function cleanupContext(
    context: Awaited<ReturnType<typeof personContext>>,
  ) {
    const em = orm.em.fork();
    await em.nativeDelete(LegislativeMandate, context.mandate.id);
    await em.nativeDelete(PersonExternalIdentity, context.identity.id);
    await em.nativeDelete(Person, context.person.id);
  }
});

function proposal(
  externalId: string,
  overrides: Partial<NormalizedLegislativeProposalData> = {},
): NormalizedLegislativeProposalData {
  return {
    source: LegislativeSource.CAMARA,
    externalId,
    type: 'PL',
    number: 42,
    year: 2026,
    title: null,
    summary: 'Resumo A',
    status: null,
    sourceStatus: 'Ativa',
    url: `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${externalId}`,
    presentedAt: '2026-03-10',
    ...overrides,
  };
}

function author(
  proposalExternalId: string,
  deputyExternalId: string,
  sourceAuthorOrder: number,
  isPrimaryAuthor: boolean,
) {
  return {
    proposalExternalId,
    deputyExternalId,
    authorType: 'Deputado(a)',
    sourceAuthorOrder,
    isPrimaryAuthor,
  };
}

function numericId(): string {
  return String(100_000_000 + Math.floor(Math.random() * 899_999_999));
}
