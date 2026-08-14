import { CandidacyStatus, ElectionType, OfficeScope } from '@eleja/database';

export interface CanonicalOfficeMapping {
  sourceCode: string;
  sourceDescription: string;
  code: string;
  name: string;
  scope: OfficeScope;
  electionType: ElectionType;
}

const GENERAL = ElectionType.GENERAL;
const STATE = OfficeScope.STATE;

export const TSE_OFFICE_MAPPINGS: readonly CanonicalOfficeMapping[] = [
  office('1', 'PRESIDENTE', 'PRESIDENT', 'Presidente', OfficeScope.NATIONAL),
  office(
    '2',
    'VICE-PRESIDENTE',
    'VICE_PRESIDENT',
    'Vice-presidente',
    OfficeScope.NATIONAL,
  ),
  office('3', 'GOVERNADOR', 'GOVERNOR', 'Governador', STATE),
  office('4', 'VICE-GOVERNADOR', 'VICE_GOVERNOR', 'Vice-governador', STATE),
  office('5', 'SENADOR', 'SENATOR', 'Senador', STATE),
  office('6', 'DEPUTADO FEDERAL', 'FEDERAL_DEPUTY', 'Deputado federal', STATE),
  office('7', 'DEPUTADO ESTADUAL', 'STATE_DEPUTY', 'Deputado estadual', STATE),
  office(
    '8',
    'DEPUTADO DISTRITAL',
    'DISTRICT_DEPUTY',
    'Deputado distrital',
    OfficeScope.DISTRICT,
  ),
  office(
    '9',
    '1º SUPLENTE',
    'SENATOR_FIRST_ALTERNATE',
    'Primeiro suplente de senador',
    STATE,
  ),
  office(
    '10',
    '2º SUPLENTE',
    'SENATOR_SECOND_ALTERNATE',
    'Segundo suplente de senador',
    STATE,
  ),
  {
    sourceCode: '11',
    sourceDescription: 'PREFEITO',
    code: 'MAYOR',
    name: 'Prefeito',
    scope: OfficeScope.MUNICIPAL,
    electionType: ElectionType.MUNICIPAL,
  },
  {
    sourceCode: '13',
    sourceDescription: 'VEREADOR',
    code: 'CITY_COUNCILOR',
    name: 'Vereador',
    scope: OfficeScope.MUNICIPAL,
    electionType: ElectionType.MUNICIPAL,
  },
];

export const TSE_CANDIDACY_STATUS_MAPPINGS: Readonly<
  Record<string, CandidacyStatus>
> = {
  '#NE': CandidacyStatus.UNKNOWN,
  APTO: CandidacyStatus.ACTIVE,
  INAPTO: CandidacyStatus.INACTIVE,
  CADASTRADO: CandidacyStatus.UNKNOWN,
};

export const TSE_ELECTION_TYPE_MAPPINGS: Readonly<
  Record<string, readonly ElectionType[]>
> = {
  '2|ELEIÇÃO ORDINÁRIA': [ElectionType.GENERAL, ElectionType.MUNICIPAL],
};

function office(
  sourceCode: string,
  sourceDescription: string,
  code: string,
  name: string,
  scope: OfficeScope,
): CanonicalOfficeMapping {
  return {
    sourceCode,
    sourceDescription,
    code,
    name,
    scope,
    electionType: GENERAL,
  };
}
