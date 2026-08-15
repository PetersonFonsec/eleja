export interface CandidateAnalyticsFilters {
  electionYear: number;
  officeCode?: string;
  state?: string;
  partyAcronym?: string;
}

export interface DeclaredWealthRankingItem {
  candidacyId: string;
  personId: string;
  ballotName: string;
  fullName: string;
  officeCode: string;
  state: string | null;
  partyAcronym: string | null;
  declaredWealth: string;
  assetCount: number;
}

export interface LatestMandateExpenseRankingItem {
  candidacyId: string;
  personId: string;
  ballotName: string;
  fullName: string;
  officeCode: string;
  state: string | null;
  partyAcronym: string | null;
  mandate: {
    id: string;
    legislatureNumber: number | null;
    startedAt: string | null;
    endedAt: string | null;
  };
  expenseCount: number;
  totalNetValue: string;
}

export interface DeclaredWealthHistory {
  personId: string;
  points: Array<{
    candidacyId: string;
    electionYear: number;
    electionType: string;
    officeCode: string;
    state: string | null;
    assetCount: number;
    declaredWealth: string;
  }>;
}

export interface CandidateDeclaredWealthHistory extends DeclaredWealthHistory {
  candidateId: string;
}

export interface ElectionAnalyticsSummary {
  candidateCount: number;
  personCount: number;
  candidatesWithDeclaredAssets: number;
  personsWithLegislativeHistory: number;
  personsWithMultipleHistoricalCandidacies: number;
  coverage: {
    withAssets: number;
    withHistoricalAssetSeries: number;
    withCamaraIdentity: number;
    withMandates: number;
    withProposals: number;
    withVotes: number;
    withExpenses: number;
  };
}

export interface CandidateLegislativeAnalyticsSummary {
  personCount: number;
  totalMandates: number;
  proposalAuthorshipCount: number;
  uniqueProposalCount: number;
  primaryAuthorshipCount: number;
  individualVoteCount: number;
  expenseRecordCount: number;
  expenseTotalNetValue: string;
}
