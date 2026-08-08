import { describe, expect, it } from 'vitest';
import { Candidacy } from '../src/entities/candidacy.entity.js';
import { CandidacyStatus } from '../src/entities/candidacy-status.js';
import { Election } from '../src/entities/election.entity.js';
import { ElectionType } from '../src/entities/election-type.js';
import { Office } from '../src/entities/office.entity.js';
import { OfficeScope } from '../src/entities/office-scope.js';
import { Party } from '../src/entities/party.entity.js';
import { Person } from '../src/entities/person.entity.js';

function createReferences() {
  return {
    person: new Person('Maria da Silva'),
    election: new Election(2026, ElectionType.GENERAL, 1),
    party: new Party('Partido Exemplo Brasileiro', 'PEB', 42),
    office: new Office('PRESIDENT', 'Presidente', OfficeScope.NATIONAL),
  };
}

describe('Candidacy', () => {
  it('creates a valid candidacy and retains its required relationships', () => {
    const references = createReferences();
    const candidacy = new Candidacy(
      references.person,
      references.election,
      references.party,
      references.office,
      'MARIA',
      {
        sourceCandidateId: 'candidate-123',
        ballotNumber: 42,
        state: 'BR',
        photoUrl: 'https://example.test/photo.jpg',
        status: CandidacyStatus.ACTIVE,
        sourceStatus: 'APTO',
      },
    );

    expect(candidacy.person).toBe(references.person);
    expect(candidacy.election).toBe(references.election);
    expect(candidacy.party).toBe(references.party);
    expect(candidacy.office).toBe(references.office);
    expect(candidacy.sourceCandidateId).toBe('candidate-123');
    expect(candidacy.ballotNumber).toBe(42);
    expect(candidacy.status).toBe(CandidacyStatus.ACTIVE);
    expect(candidacy.sourceStatus).toBe('APTO');
  });

  it('defaults to unknown status while preserving no source status', () => {
    const references = createReferences();
    const candidacy = new Candidacy(
      references.person,
      references.election,
      references.party,
      references.office,
      'MARIA',
    );

    expect(candidacy.status).toBe(CandidacyStatus.UNKNOWN);
    expect(candidacy.sourceStatus).toBeNull();
  });

  it('requires a ballot name', () => {
    const references = createReferences();

    expect(
      () =>
        new Candidacy(
          references.person,
          references.election,
          references.party,
          references.office,
          ' ',
        ),
    ).toThrow('Candidacy ballot name must not be empty');
  });

  it('accepts a positive ballot number', () => {
    const references = createReferences();
    const candidacy = new Candidacy(
      references.person,
      references.election,
      references.party,
      references.office,
      'MARIA',
      { ballotNumber: 13 },
    );

    expect(candidacy.ballotNumber).toBe(13);
  });

  it.each([-1, 0, 1.5])('rejects invalid ballot number %s', (ballotNumber) => {
    const references = createReferences();

    expect(
      () =>
        new Candidacy(
          references.person,
          references.election,
          references.party,
          references.office,
          'MARIA',
          { ballotNumber },
        ),
    ).toThrow('Candidacy ballot number must be a positive integer or null');
  });

  it('requires all historical relationships', () => {
    const references = createReferences();

    expect(
      () =>
        new Candidacy(
          undefined as never,
          references.election,
          references.party,
          references.office,
          'MARIA',
        ),
    ).toThrow('Candidacy requires person, election, party, and office');
  });
});
