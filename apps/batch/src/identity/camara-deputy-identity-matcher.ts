import type { CamaraDeputyRecord } from '../sources/camara/camara-deputy-record.js';
import type { Person } from '@eleja/database';

export interface DeputyMatchPerson {
  id: Person['id'];
  name: string;
  birthDate: string | null;
  states?: readonly string[];
  ballotNames?: readonly string[];
  partyAcronyms?: readonly string[];
}

export interface DeputyMatchEvidence {
  normalizedName: 'EXACT';
  birthDate: 'EXACT';
  state: 'MATCH' | 'MISMATCH' | 'NOT_AVAILABLE';
  parliamentaryName: 'MATCH' | 'MISMATCH' | 'NOT_AVAILABLE';
  party: 'MATCH' | 'MISMATCH' | 'NOT_AVAILABLE';
}

export type DeputyIdentityMatchResult =
  | {
      status: 'MATCHED';
      personId: string;
      deputy: CamaraDeputyRecord;
      evidence: DeputyMatchEvidence;
    }
  | {
      status: 'AMBIGUOUS';
      personId: string;
      candidateExternalIds: string[];
    }
  | { status: 'NOT_FOUND'; personId: string };

export class CamaraDeputyIdentityMatcher {
  private readonly deputiesByStrongIdentity = new Map<
    string,
    CamaraDeputyRecord[]
  >();

  constructor(deputies: readonly CamaraDeputyRecord[]) {
    for (const deputy of deputies) {
      if (deputy.birthDate === null) continue;
      const key = identityKey(deputy.name, deputy.birthDate);
      const matches = this.deputiesByStrongIdentity.get(key) ?? [];
      matches.push(deputy);
      this.deputiesByStrongIdentity.set(key, matches);
    }
  }

  match(person: DeputyMatchPerson): DeputyIdentityMatchResult {
    if (person.birthDate === null)
      return { status: 'NOT_FOUND', personId: person.id };
    const candidates =
      this.deputiesByStrongIdentity.get(
        identityKey(person.name, person.birthDate),
      ) ?? [];
    if (candidates.length === 0)
      return { status: 'NOT_FOUND', personId: person.id };
    if (candidates.length > 1) {
      return {
        status: 'AMBIGUOUS',
        personId: person.id,
        candidateExternalIds: candidates.map(
          (candidate) => candidate.externalId,
        ),
      };
    }

    const deputy = candidates[0];
    if (!deputy) return { status: 'NOT_FOUND', personId: person.id };
    return {
      status: 'MATCHED',
      personId: person.id,
      deputy,
      evidence: {
        normalizedName: 'EXACT',
        birthDate: 'EXACT',
        state: supportingSignal(person.states, deputy.state, normalizeCode),
        parliamentaryName: supportingSignal(
          person.ballotNames,
          deputy.parliamentaryName,
          normalizeName,
        ),
        party: supportingSignal(
          person.partyAcronyms,
          deputy.partyAcronym,
          normalizeCode,
        ),
      },
    };
  }
}

export function normalizeName(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('pt-BR');
}

function identityKey(name: string, birthDate: string): string {
  return `${normalizeName(name)}\u0000${birthDate}`;
}

function normalizeCode(value: string): string {
  return value.trim().toLocaleUpperCase('pt-BR');
}

function supportingSignal(
  values: readonly string[] | undefined,
  sourceValue: string | null,
  normalize: (value: string) => string,
): 'MATCH' | 'MISMATCH' | 'NOT_AVAILABLE' {
  if (!values?.length || sourceValue === null) return 'NOT_AVAILABLE';
  const expected = normalize(sourceValue);
  return values.some((value) => normalize(value) === expected)
    ? 'MATCH'
    : 'MISMATCH';
}
