export const TSE_CANDIDATE_ASSET_COLUMNS = {
  electionYear: 'ANO_ELEICAO',
  candidateId: 'SQ_CANDIDATO',
  sourceSequence: 'NR_ORDEM_BEM_CANDIDATO',
  typeCode: 'CD_TIPO_BEM_CANDIDATO',
  typeDescription: 'DS_TIPO_BEM_CANDIDATO',
  description: 'DS_BEM_CANDIDATO',
  declaredValue: 'VR_BEM_CANDIDATO',
} as const;

export const REQUIRED_TSE_CANDIDATE_ASSET_COLUMNS = Object.values(
  TSE_CANDIDATE_ASSET_COLUMNS,
);
