import { describe, expect, it } from 'vitest';
import { CandidateSourceType } from '../src/entities/candidate-source-type.js';
import { CandidateSource } from '../src/entities/candidate-source.entity.js';
import { Candidacy } from '../src/entities/candidacy.entity.js';
import { Election } from '../src/entities/election.entity.js';
import { ElectionType } from '../src/entities/election-type.js';
import { Office } from '../src/entities/office.entity.js';
import { OfficeScope } from '../src/entities/office-scope.js';
import { Party } from '../src/entities/party.entity.js';
import { Person } from '../src/entities/person.entity.js';

function createCandidacy(): Candidacy {
  return new Candidacy(
    new Person('Maria da Silva'),
    new Election(2026, ElectionType.GENERAL, 1),
    new Party('Partido Exemplo', 'PEX', 42),
    new Office('PRESIDENT', 'Presidente', OfficeScope.NATIONAL),
    'MARIA',
    { sourceCandidateId: '123' },
  );
}

describe('CandidateSource', () => {
  it('preserves official RAW evidence separately from the candidacy', () => {
    const importedAt = new Date('2026-08-08T12:00:00.000Z');
    const source = new CandidateSource(
      createCandidacy(),
      CandidateSourceType.TSE,
      'Tribunal Superior Eleitoral',
      '123',
      `tse/2026/candidates/${'a'.repeat(64)}/candidates.zip`,
      'A'.repeat(64),
      { sourceUrl: 'https://cdn.tse.jus.br/candidates.zip', importedAt },
    );

    expect(source.type).toBe(CandidateSourceType.TSE);
    expect(source.rawChecksum).toBe('a'.repeat(64));
    expect(source.importedAt).toEqual(importedAt);
    expect(source.lastCheckedAt).toEqual(importedAt);
  });

  it('rejects absolute storage paths and invalid checksums', () => {
    expect(
      () =>
        new CandidateSource(
          createCandidacy(),
          CandidateSourceType.TSE,
          'TSE',
          '123',
          '/Users/name/raw.zip',
          'a'.repeat(64),
        ),
    ).toThrow('Candidate source RAW storage key must be relative');
    expect(
      () =>
        new CandidateSource(
          createCandidacy(),
          CandidateSourceType.TSE,
          'TSE',
          '123',
          'tse/raw.zip',
          'invalid',
        ),
    ).toThrow('Candidate source RAW checksum must be SHA-256');
  });
});
