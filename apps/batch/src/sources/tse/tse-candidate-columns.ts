export const TSE_CANDIDATE_COLUMNS = {
  electionYear: 'ANO_ELEICAO',
  electionTypeCode: 'CD_TIPO_ELEICAO',
  electionType: 'NM_TIPO_ELEICAO',
  electionRound: 'NR_TURNO',
  candidateId: 'SQ_CANDIDATO',
  candidateFullName: 'NM_CANDIDATO',
  candidateBallotName: 'NM_URNA_CANDIDATO',
  candidateBallotNumber: 'NR_CANDIDATO',
  partyNumber: 'NR_PARTIDO',
  partyAcronym: 'SG_PARTIDO',
  partyName: 'NM_PARTIDO',
  officeCode: 'CD_CARGO',
  officeDescription: 'DS_CARGO',
  state: 'SG_UF',
  electoralUnitCode: 'SG_UE',
  electoralUnitName: 'NM_UE',
  birthDate: 'DT_NASCIMENTO',
  gender: 'DS_GENERO',
  education: 'DS_GRAU_INSTRUCAO',
  occupation: 'DS_OCUPACAO',
  candidacyStatus: 'DS_SITUACAO_CANDIDATURA',
} as const;

export const REQUIRED_TSE_CANDIDATE_COLUMNS = Object.values(
  TSE_CANDIDATE_COLUMNS,
);
