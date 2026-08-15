export interface AnalyticsFilters {
  year: number;
  office?: string;
  state?: string;
  party?: string;
}

export interface AnalyticsSummary {
  filters: PublicAnalyticsFilters;
  candidates: {
    total: number;
    distinctPeople: number;
    withDeclaredAssets: number;
    withLegislativeHistory: number;
    withHistoricalAssetSeries: number;
    withMultipleHistoricalCandidacies: number;
  };
}

export interface AnalyticsCoverage {
  filters: PublicAnalyticsFilters;
  candidateCount: number;
  distinctPeople: number;
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

export interface PublicAnalyticsFilters {
  year: number;
  office: string | null;
  state: string | null;
  party: string | null;
}

export interface AnalyticsRankingResponse<T> {
  data: T[];
  meta: { limit: number };
}

export interface FinancialRankingCandidate {
  candidateId: string;
  personId: string;
  ballotName: string;
  fullName: string;
  officeCode: string;
  state: string | null;
  partyAcronym: string | null;
}

export interface DeclaredWealthRankingItem extends FinancialRankingCandidate {
  declaredWealth: string;
  assetCount: number;
}

export interface ParliamentaryExpenseRankingItem extends FinancialRankingCandidate {
  mandate: {
    id: string;
    legislatureNumber: number | null;
    startedAt: string | null;
    endedAt: string | null;
  };
  expenseCount: number;
  totalNetValue: string;
}

export type DeclaredWealthRanking =
  AnalyticsRankingResponse<DeclaredWealthRankingItem>;
export type ParliamentaryExpenseRanking =
  AnalyticsRankingResponse<ParliamentaryExpenseRankingItem>;
