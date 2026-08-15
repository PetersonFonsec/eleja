import type {
  CandidateDeclaredWealthHistory,
  CandidateLegislativeAnalyticsSummary,
  DeclaredWealthRankingItem,
  ElectionAnalyticsSummary,
  LatestMandateExpenseRankingItem,
} from '../analytics.types.js';
import type {
  AnalyticsFilterQueryDto,
  AnalyticsRankingQueryDto,
} from './analytics-query.dto.js';

export function publicFilters(query: AnalyticsFilterQueryDto) {
  return {
    year: query.year,
    office: query.office ?? null,
    state: query.state ?? null,
    party: query.party ?? null,
  };
}

export function summaryResponse(
  query: AnalyticsFilterQueryDto,
  value: ElectionAnalyticsSummary,
) {
  return {
    filters: publicFilters(query),
    candidates: {
      total: value.candidateCount,
      distinctPeople: value.personCount,
      withDeclaredAssets: value.candidatesWithDeclaredAssets,
      withLegislativeHistory: value.personsWithLegislativeHistory,
      withHistoricalAssetSeries: value.coverage.withHistoricalAssetSeries,
      withMultipleHistoricalCandidacies:
        value.personsWithMultipleHistoricalCandidacies,
    },
  };
}

export function wealthRankingResponse(
  query: AnalyticsRankingQueryDto,
  data: DeclaredWealthRankingItem[],
) {
  return {
    data: data.map(({ candidacyId, ...item }) => ({
      candidateId: candidacyId,
      ...item,
    })),
    meta: { limit: query.limit },
  };
}

export function expenseRankingResponse(
  query: AnalyticsRankingQueryDto,
  data: LatestMandateExpenseRankingItem[],
) {
  return {
    data: data.map(({ candidacyId, ...item }) => ({
      candidateId: candidacyId,
      ...item,
    })),
    meta: { limit: query.limit },
  };
}

export function wealthHistoryResponse(value: CandidateDeclaredWealthHistory) {
  return {
    candidateId: value.candidateId,
    personId: value.personId,
    hasHistoricalSeries: value.points.length >= 2,
    data: value.points.map(({ candidacyId, ...point }) => ({
      candidateId: candidacyId,
      ...point,
    })),
  };
}

export function legislativeResponse(
  query: AnalyticsFilterQueryDto,
  coverage: ElectionAnalyticsSummary,
  value: CandidateLegislativeAnalyticsSummary,
) {
  return {
    filters: publicFilters(query),
    peopleWithLegislativeHistory: coverage.personsWithLegislativeHistory,
    populationPeople: value.personCount,
    mandates: value.totalMandates,
    proposalAuthorships: value.proposalAuthorshipCount,
    primaryAuthorships: value.primaryAuthorshipCount,
    uniqueProposals: value.uniqueProposalCount,
    individualVotes: value.individualVoteCount,
    parliamentaryExpenses: {
      count: value.expenseRecordCount,
      totalNetValue: value.expenseTotalNetValue,
    },
  };
}

export function coverageResponse(
  query: AnalyticsFilterQueryDto,
  value: ElectionAnalyticsSummary,
) {
  return {
    filters: publicFilters(query),
    candidateCount: value.candidateCount,
    distinctPeople: value.personCount,
    coverage: value.coverage,
  };
}
