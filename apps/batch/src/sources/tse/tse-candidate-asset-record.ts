export interface TseCandidateAssetRecord {
  electionYear: number;
  candidateId: string;
  sourceSequence: number;
  typeCode: string;
  typeDescription: string;
  description: string;
  declaredValue: string;
}

export interface TseCandidateAssetParseIssue {
  rowNumber: number;
  field?: string;
  value?: string;
  reason: string;
}

export type TseCandidateAssetParseResult =
  | { status: 'SUCCESS'; record: TseCandidateAssetRecord }
  | { status: 'REJECTED'; issue: TseCandidateAssetParseIssue };

export interface TseCandidateAssetParsingStatistics {
  csvEntry: string;
  encoding: 'ISO-8859-1';
  delimiter: ';';
  recordsRead: number;
  recordsParsed: number;
  recordsRejected: number;
}
