import { describe, expect, it } from 'vitest';
import {
  CamaraDeputyIdentityMatcher,
  normalizeName,
} from '../src/identity/camara-deputy-identity-matcher.js';
import type { CamaraDeputyRecord } from '../src/sources/camara/camara-deputy-record.js';

describe('CamaraDeputyIdentityMatcher', () => {
  it('matches only exact normalized full name and birth date', () => {
    const matcher = new CamaraDeputyIdentityMatcher([
      deputy('1', 'JOÃO DA SILVA', '1980-01-15'),
    ]);
    const result = matcher.match(person('João   da Silva', '1980-01-15'));
    expect(result).toMatchObject({
      status: 'MATCHED',
      deputy: { externalId: '1' },
    });
    expect(normalizeName('  João   da Silva ')).toBe('JOÃO DA SILVA');
  });

  it('does not match the same name with another birth date', () => {
    const matcher = new CamaraDeputyIdentityMatcher([
      deputy('1', 'João Silva', '1970-01-01'),
    ]);
    expect(matcher.match(person('João Silva', '1980-01-01')).status).toBe(
      'NOT_FOUND',
    );
  });

  it('does not use name alone when the person has no birth date', () => {
    const matcher = new CamaraDeputyIdentityMatcher([
      deputy('1', 'João Silva', '1980-01-01'),
    ]);
    expect(matcher.match(person('João Silva', null)).status).toBe('NOT_FOUND');
  });

  it('reports ambiguity when multiple records satisfy both strong signals', () => {
    const matcher = new CamaraDeputyIdentityMatcher([
      deputy('1', 'João Silva', '1980-01-01'),
      deputy('2', 'JOÃO SILVA', '1980-01-01'),
    ]);
    expect(matcher.match(person('João Silva', '1980-01-01'))).toEqual({
      status: 'AMBIGUOUS',
      personId: expect.any(String),
      candidateExternalIds: ['1', '2'],
    });
  });

  it('keeps a strong match despite party change', () => {
    const matcher = new CamaraDeputyIdentityMatcher([
      deputy('1', 'João Silva', '1980-01-01', 'XYZ'),
    ]);
    const result = matcher.match({
      ...person('João Silva', '1980-01-01'),
      partyAcronyms: ['ABC'],
    });
    expect(result.status).toBe('MATCHED');
    if (result.status === 'MATCHED')
      expect(result.evidence.party).toBe('MISMATCH');
  });
});

function person(name: string, birthDate: string | null) {
  return {
    id: '00000000-0000-4000-8000-000000000001' as const,
    name,
    birthDate,
  };
}

function deputy(
  externalId: string,
  name: string,
  birthDate: string,
  partyAcronym = 'ABC',
): CamaraDeputyRecord {
  return {
    externalId,
    name,
    birthDate,
    parliamentaryName: 'João',
    state: 'SP',
    partyAcronym,
    photoUrl: null,
    profileUrl: `https://dadosabertos.camara.leg.br/api/v2/deputados/${externalId}`,
  };
}
