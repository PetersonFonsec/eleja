import type {
  LegislativeSource,
  LegislativeVotePosition,
  LegislativeVotingResult,
} from '@eleja/database';

export interface NormalizedLegislativeVotingData {
  source: LegislativeSource;
  externalId: string;
  dateTime: Date;
  description: string | null;
  result: LegislativeVotingResult;
  sourceResult: string | null;
  proposalExternalId: string | null;
  sourceUrl: string;
}

export interface NormalizedLegislativeVoteData {
  votingExternalId: string;
  deputyExternalId: string;
  position: LegislativeVotePosition;
  sourcePosition: string;
  votedAt: Date | null;
}

export type NormalizationResult<T> =
  | { status: 'NORMALIZED'; data: T; issues: Array<{ reason: string }> }
  | { status: 'REJECTED'; issues: Array<{ reason: string }> };
