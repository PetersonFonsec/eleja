export interface TseCandidateRecord {
  electionYear: number;
  electionTypeCode: number;
  electionType: string;
  electionRound: number;
  candidateId: string;
  candidateFullName: string;
  candidateBallotName: string;
  candidateCpf?: string;
  candidateBallotNumber: number;
  partySourceId: string;
  partyAcronym: string;
  partyName: string;
  partyNumber: number;
  officeSourceCode: string;
  officeDescription: string;
  state: string;
  electoralUnitCode: string;
  electoralUnitName: string;
  birthDate: string;
  birthState?: string;
  gender: string;
  education: string;
  occupation: string;
  candidacyStatus: string;
}

export interface TseCandidateParseIssue {
  rowNumber: number;
  field?: string;
  value?: string;
  reason: string;
}

export type TseCandidateParseResult =
  | { status: 'SUCCESS'; record: TseCandidateRecord }
  | { status: 'REJECTED'; issue: TseCandidateParseIssue };

export interface TseCandidateParsingStatistics {
  csvEntry: string;
  encoding: 'ISO-8859-1';
  delimiter: ';';
  recordsRead: number;
  recordsParsed: number;
  recordsRejected: number;
  durationMs: number;
}
