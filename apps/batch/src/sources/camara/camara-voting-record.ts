export interface CamaraVotingPeriod {
  startDate: string;
  endDate: string;
}

export interface CamaraVotingRecord {
  externalId: string;
  sourceUrl: string;
  date: string;
  registeredAt: string;
  description: string | null;
  approval: 0 | 1 | null;
  proposalExternalId: string | null;
}

export interface CamaraDeputyVoteRecord {
  votingExternalId: string;
  deputyExternalId: string | null;
  sourcePosition: string;
  registeredAt: string | null;
}
