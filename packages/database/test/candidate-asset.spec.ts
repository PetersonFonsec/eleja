import { describe, expect, it } from 'vitest';
import { CandidateAsset } from '../src/entities/candidate-asset.entity.js';
import { Candidacy } from '../src/entities/candidacy.entity.js';
import { Election } from '../src/entities/election.entity.js';
import { ElectionType } from '../src/entities/election-type.js';
import { Office } from '../src/entities/office.entity.js';
import { OfficeScope } from '../src/entities/office-scope.js';
import { Party } from '../src/entities/party.entity.js';
import { Person } from '../src/entities/person.entity.js';

function candidacy() {
  return new Candidacy(
    new Person('Maria'),
    new Election(2026, ElectionType.GENERAL, 1),
    new Party('Partido', 'PAR', 10),
    new Office('PRESIDENT', 'Presidente', OfficeScope.NATIONAL),
    'MARIA',
  );
}

describe('CandidateAsset', () => {
  it('stores exact decimal values', () => {
    expect(
      new CandidateAsset(candidacy(), 1, '21', 'Veículo', null, '150000.00')
        .value,
    ).toBe('150000.00');
    expect(
      new CandidateAsset(candidacy(), 1, '21', 'Veículo', null, '-38101.07')
        .value,
    ).toBe('-38101.07');
  });
  it.each(['150000', '1.5', '--1.00', 'NaN'])(
    'rejects non-canonical decimal %s',
    (value) => {
      expect(
        () => new CandidateAsset(candidacy(), 1, '21', 'Veículo', null, value),
      ).toThrow('exact decimal');
    },
  );
});
