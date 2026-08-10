import { describe, expect, it } from 'vitest';
import { LegislativeBody } from '../src/entities/legislative-body.js';
import { LegislativeMandate } from '../src/entities/legislative-mandate.entity.js';
import { LegislativeProposalAuthor } from '../src/entities/legislative-proposal-author.entity.js';
import { LegislativeProposal } from '../src/entities/legislative-proposal.entity.js';
import { LegislativeSource } from '../src/entities/legislative-source.js';
import { PersonExternalIdentitySource } from '../src/entities/person-external-identity-source.js';
import { PersonExternalIdentity } from '../src/entities/person-external-identity.entity.js';
import { Person } from '../src/entities/person.entity.js';

describe('legislative model', () => {
  it('creates a source-aware external identity with optional verification', () => {
    const person = new Person('Maria da Silva');
    const identity = new PersonExternalIdentity(
      person,
      PersonExternalIdentitySource.CAMARA,
      '123',
      { sourceUrl: 'https://dadosabertos.camara.leg.br/' },
    );

    expect(identity.person).toBe(person);
    expect(identity.source).toBe(PersonExternalIdentitySource.CAMARA);
    expect(identity.externalId).toBe('123');
    expect(identity.verifiedAt).toBeNull();
  });

  it('validates mandate dates and canonical UF', () => {
    const person = new Person('Maria da Silva');
    const mandate = new LegislativeMandate(
      person,
      LegislativeBody.CHAMBER_OF_DEPUTIES,
      { state: 'SP', startedAt: '2023-02-01', endedAt: '2027-01-31' },
    );

    expect(mandate.person).toBe(person);
    expect(mandate.state).toBe('SP');
    expect(
      () =>
        new LegislativeMandate(person, LegislativeBody.SENATE, {
          state: 'XX',
        }),
    ).toThrow('Legislative mandate state must be a valid UF');
    expect(
      () =>
        new LegislativeMandate(person, LegislativeBody.SENATE, {
          startedAt: '2027-01-01',
          endedAt: '2026-01-01',
        }),
    ).toThrow('Legislative mandate end cannot precede start');
  });

  it('creates a source-aware proposal while preserving source status', () => {
    const proposal = new LegislativeProposal(
      LegislativeSource.CAMARA,
      '987',
      'PL',
      {
        number: 123,
        year: 2025,
        summary: 'Resumo oficial',
        sourceStatus: 'Aguardando Parecer',
      },
    );

    expect(proposal.externalId).toBe('987');
    expect(proposal.type).toBe('PL');
    expect(proposal.year).toBe(2025);
    expect(proposal.sourceStatus).toBe('Aguardando Parecer');
    expect(proposal.status).toBeNull();
  });

  it('rejects authorship linked to another person mandate', () => {
    const author = new Person('Pessoa autora');
    const otherPerson = new Person('Outra pessoa');
    const otherMandate = new LegislativeMandate(
      otherPerson,
      LegislativeBody.CHAMBER_OF_DEPUTIES,
    );
    const proposal = new LegislativeProposal(
      LegislativeSource.CAMARA,
      'proposal-1',
      'PL',
    );

    expect(
      () =>
        new LegislativeProposalAuthor(proposal, author, {
          mandate: otherMandate,
        }),
    ).toThrow('Proposal authorship mandate must belong to its person');
  });
});
