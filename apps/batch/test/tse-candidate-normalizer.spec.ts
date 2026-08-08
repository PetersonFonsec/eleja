import { CandidacyStatus, ElectionType, OfficeScope } from '@eleja/database';
import { describe, expect, it } from 'vitest';
import { TseCandidateNormalizer } from '../src/normalization/tse-candidate-normalizer.js';
import type { TseCandidateRecord } from '../src/sources/tse/tse-candidate-record.js';

function candidate(
  overrides: Partial<TseCandidateRecord> = {},
): TseCandidateRecord {
  return {
    electionYear: 2026,
    electionTypeCode: 2,
    electionType: 'ELEIÇÃO ORDINÁRIA',
    electionRound: 1,
    candidateId: '280001234567',
    candidateFullName: 'JOÃO GONÇALVES',
    candidateBallotName: 'JOÃO',
    candidateBallotNumber: 13,
    partySourceId: '13',
    partyAcronym: 'PT',
    partyName: 'PARTIDO DOS TRABALHADORES',
    partyNumber: 13,
    officeSourceCode: '1',
    officeDescription: 'PRESIDENTE',
    state: 'BR',
    electoralUnitCode: 'BR',
    electoralUnitName: 'BRASIL',
    birthDate: '1980-02-29',
    gender: 'MASCULINO',
    education: 'SUPERIOR COMPLETO',
    occupation: 'PROFESSOR',
    candidacyStatus: '#NE',
    ...overrides,
  };
}

describe('TseCandidateNormalizer', () => {
  const normalizer = new TseCandidateNormalizer();

  it('normalizes a complete presidential candidacy', () => {
    expect(normalizer.normalize(candidate())).toEqual({
      status: 'SUCCESS',
      data: {
        election: { year: 2026, type: ElectionType.GENERAL, round: 1 },
        party: {
          sourcePartyId: '13',
          name: 'PARTIDO DOS TRABALHADORES',
          acronym: 'PT',
          number: 13,
        },
        office: {
          sourceCode: '1',
          code: 'PRESIDENT',
          name: 'Presidente',
          scope: OfficeScope.NATIONAL,
        },
        person: {
          name: 'JOÃO GONÇALVES',
          birthDate: '1980-02-29',
          gender: 'MASCULINO',
          education: 'SUPERIOR COMPLETO',
          occupation: 'PROFESSOR',
        },
        candidacy: {
          sourceCandidateId: '280001234567',
          ballotName: 'JOÃO',
          ballotNumber: 13,
          state: null,
          city: null,
          photoUrl: null,
          status: CandidacyStatus.UNKNOWN,
          sourceStatus: '#NE',
        },
      },
    });
  });

  it('normalizes a state-level candidacy', () => {
    const result = normalizer.normalize(
      candidate({
        officeSourceCode: '3',
        officeDescription: 'GOVERNADOR',
        state: ' sp ',
        electoralUnitCode: 'SP',
        electoralUnitName: 'SÃO PAULO',
      }),
    );

    expect(result).toEqual({
      status: 'SUCCESS',
      data: expect.objectContaining({
        office: expect.objectContaining({
          code: 'GOVERNOR',
          scope: OfficeScope.STATE,
        }),
        candidacy: expect.objectContaining({ state: 'SP', city: null }),
      }),
    });
  });

  it('normalizes a federal deputy candidacy', () => {
    const result = normalizer.normalize(
      candidate({
        officeSourceCode: '6',
        officeDescription: 'DEPUTADO FEDERAL',
        state: 'MG',
      }),
    );

    expect(result).toEqual({
      status: 'SUCCESS',
      data: expect.objectContaining({
        office: expect.objectContaining({
          code: 'FEDERAL_DEPUTY',
          scope: OfficeScope.STATE,
        }),
        candidacy: expect.objectContaining({ state: 'MG' }),
      }),
    });
  });

  it.each([
    ['1', 'PRESIDENTE', 'PRESIDENT', OfficeScope.NATIONAL],
    ['2', 'VICE-PRESIDENTE', 'VICE_PRESIDENT', OfficeScope.NATIONAL],
    ['3', 'GOVERNADOR', 'GOVERNOR', OfficeScope.STATE],
    ['4', 'VICE-GOVERNADOR', 'VICE_GOVERNOR', OfficeScope.STATE],
    ['5', 'SENADOR', 'SENATOR', OfficeScope.STATE],
    ['6', 'DEPUTADO FEDERAL', 'FEDERAL_DEPUTY', OfficeScope.STATE],
    ['7', 'DEPUTADO ESTADUAL', 'STATE_DEPUTY', OfficeScope.STATE],
    ['8', 'DEPUTADO DISTRITAL', 'DISTRICT_DEPUTY', OfficeScope.DISTRICT],
    ['9', '1º SUPLENTE', 'SENATOR_FIRST_ALTERNATE', OfficeScope.STATE],
    ['10', '2º SUPLENTE', 'SENATOR_SECOND_ALTERNATE', OfficeScope.STATE],
  ])(
    'maps current TSE office %s/%s',
    (sourceCode, sourceDescription, code, scope) => {
      const state = scope === OfficeScope.NATIONAL ? 'BR' : 'DF';
      const result = normalizer.normalize(
        candidate({
          officeSourceCode: sourceCode,
          officeDescription: sourceDescription,
          state,
        }),
      );

      expect(result).toEqual({
        status: 'SUCCESS',
        data: expect.objectContaining({
          office: expect.objectContaining({ code, scope }),
        }),
      });
    },
  );

  it('maps a documented municipal office and municipality', () => {
    const result = normalizer.normalize(
      candidate({
        officeSourceCode: '11',
        officeDescription: 'PREFEITO',
        state: 'SP',
        electoralUnitName: ' São   Paulo ',
      }),
    );

    expect(result).toEqual({
      status: 'SUCCESS',
      data: expect.objectContaining({
        election: expect.objectContaining({ type: ElectionType.MUNICIPAL }),
        office: expect.objectContaining({
          code: 'MAYOR',
          scope: OfficeScope.MUNICIPAL,
        }),
        candidacy: expect.objectContaining({ state: 'SP', city: 'São Paulo' }),
      }),
    });
  });

  it('accepts a supported second election round', () => {
    const result = normalizer.normalize(candidate({ electionRound: 2 }));

    expect(result).toEqual({
      status: 'SUCCESS',
      data: expect.objectContaining({
        election: { year: 2026, type: ElectionType.GENERAL, round: 2 },
      }),
    });
  });

  it('preserves accents while safely normalizing whitespace and optional strings', () => {
    const result = normalizer.normalize(
      candidate({
        candidateFullName: '  JOÃO   GONÇALVES  ',
        candidateBallotName: '  JOÃO  ',
        partyName: ' PARTIDO   MISSÃO ',
        partyAcronym: ' missão ',
        partySourceId: '   ',
        gender: ' ',
        education: ' EDUCAÇÃO   SUPERIOR ',
        occupation: '',
      }),
    );

    expect(result).toEqual({
      status: 'SUCCESS',
      data: expect.objectContaining({
        party: expect.objectContaining({
          sourcePartyId: null,
          name: 'PARTIDO MISSÃO',
          acronym: 'MISSÃO',
        }),
        person: {
          name: 'JOÃO GONÇALVES',
          birthDate: '1980-02-29',
          gender: null,
          education: 'EDUCAÇÃO SUPERIOR',
          occupation: null,
        },
        candidacy: expect.objectContaining({ ballotName: 'JOÃO' }),
      }),
    });
  });

  it('maps the observed TSE status and preserves its source value', () => {
    const result = normalizer.normalize(
      candidate({ candidacyStatus: ' #NE ' }),
    );

    expect(result).toEqual({
      status: 'SUCCESS',
      data: expect.objectContaining({
        candidacy: expect.objectContaining({
          status: CandidacyStatus.UNKNOWN,
          sourceStatus: '#NE',
        }),
      }),
    });
  });

  it.each([
    [
      { electionType: 'ELEIÇÃO SUPLEMENTAR' },
      'electionType',
      'unsupported election type',
    ],
    [{ electionRound: 3 }, 'electionRound', 'unsupported election round'],
    [{ officeDescription: 'CARGO NOVO' }, 'office', 'unsupported office'],
    [
      { candidacyStatus: 'VALOR NOVO' },
      'candidacyStatus',
      'unsupported candidacy status',
    ],
    [
      { state: 'XX', officeSourceCode: '3', officeDescription: 'GOVERNADOR' },
      'state',
      'invalid UF',
    ],
  ] as const)(
    'rejects unsupported canonical mapping %#',
    (overrides, field, reason) => {
      const result = normalizer.normalize(candidate(overrides));

      expect(result).toEqual({
        status: 'REJECTED',
        issue: expect.objectContaining({
          sourceCandidateId: '280001234567',
          field,
          reason,
        }),
      });
    },
  );
});
