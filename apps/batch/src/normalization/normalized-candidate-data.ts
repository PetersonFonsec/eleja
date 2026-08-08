import type {
  CandidacyStatus,
  ElectionType,
  OfficeScope,
} from '@eleja/database';

export interface NormalizedCandidateData {
  election: {
    year: number;
    type: ElectionType;
    round: 1 | 2 | null;
  };
  party: {
    sourcePartyId: string | null;
    name: string;
    acronym: string;
    number: number | null;
  };
  office: {
    sourceCode: string | null;
    code: string;
    name: string;
    scope: OfficeScope;
  };
  person: {
    name: string;
    birthDate: string | null;
    gender: string | null;
    education: string | null;
    occupation: string | null;
  };
  candidacy: {
    sourceCandidateId: string;
    ballotName: string;
    ballotNumber: number | null;
    state: string | null;
    city: string | null;
    photoUrl: string | null;
    status: CandidacyStatus;
    sourceStatus: string | null;
  };
}

export interface CandidateNormalizationIssue {
  sourceCandidateId: string;
  field: string;
  sourceValue: string;
  reason: string;
}

export type CandidateNormalizationResult =
  | { status: 'SUCCESS'; data: NormalizedCandidateData }
  | { status: 'REJECTED'; issue: CandidateNormalizationIssue };
