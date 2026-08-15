import '@angular/compiler';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsApiService } from './analytics-api.service';
import type {
  AnalyticsCoverage,
  AnalyticsSummary,
  DeclaredWealthRanking,
  ParliamentaryExpenseRanking,
} from './analytics.types';
import { DashboardCoverageComponent } from './dashboard-coverage.component';
import {
  DashboardPageComponent,
  parseDashboardFilters,
} from './dashboard-page.component';
import { DashboardSummaryComponent } from './dashboard-summary.component';

const summary = (total: number): AnalyticsSummary => ({
  filters: { year: 2026, office: null, state: null, party: null },
  candidates: {
    total,
    distinctPeople: total,
    withDeclaredAssets: 28_943,
    withLegislativeHistory: 1_243,
    withHistoricalAssetSeries: 438,
    withMultipleHistoricalCandidacies: 500,
  },
});
const coverage = (total: number): AnalyticsCoverage => ({
  filters: { year: 2026, office: null, state: null, party: null },
  candidateCount: total,
  distinctPeople: total,
  coverage: {
    withAssets: 28_943,
    withHistoricalAssetSeries: 438,
    withCamaraIdentity: 1_268,
    withMandates: 1_243,
    withProposals: 1_197,
    withVotes: 1_102,
    withExpenses: 1_218,
  },
});
const wealth = (candidateId = 'candidate-1'): DeclaredWealthRanking => ({
  data: [
    {
      candidateId,
      personId: 'person-1',
      ballotName: 'Candidatura',
      fullName: 'Nome completo',
      officeCode: 'FEDERAL_DEPUTY',
      state: 'SP',
      partyAcronym: 'ABC',
      declaredWealth: '1000.10',
      assetCount: 2,
    },
  ],
  meta: { limit: 10 },
});
const expenses = (
  candidateId = 'candidate-1',
): ParliamentaryExpenseRanking => ({
  data: [
    {
      candidateId,
      personId: 'person-1',
      ballotName: 'Candidatura',
      fullName: 'Nome completo',
      officeCode: 'FEDERAL_DEPUTY',
      state: 'SP',
      partyAcronym: 'ABC',
      mandate: {
        id: 'mandate-1',
        legislatureNumber: 57,
        startedAt: '2023-02-01',
        endedAt: null,
      },
      expenseCount: 3,
      totalNetValue: '12450000.75',
    },
  ],
  meta: { limit: 10 },
});

describe('DashboardPageComponent', () => {
  it('hydrates validated URL filters and requests summary and coverage once', () => {
    const fixture = setup(
      () => of(summary(31_482)),
      () => of(coverage(31_482)),
      {
        year: '2026',
        office: 'federal_deputy',
        state: 'sp',
        party: 'pt',
      },
    );
    expect(fixture.page.filters()).toEqual({
      year: 2026,
      office: 'FEDERAL_DEPUTY',
      state: 'SP',
      party: 'PT',
    });
    expect(fixture.summaryRequest).toHaveBeenCalledOnce();
    expect(fixture.coverageRequest).toHaveBeenCalledOnce();
    expect(fixture.wealthRequest).toHaveBeenCalledWith(
      fixture.page.filters(),
      10,
    );
    expect(fixture.expensesRequest).toHaveBeenCalledWith(
      fixture.page.filters(),
      10,
    );
    expect(fixture.page.summary()?.candidates.total).toBe(31_482);
  });

  it('updates URL state without losing active filters or refetching equal state', () => {
    const fixture = setup(
      () => of(summary(1)),
      () => of(coverage(1)),
      {
        year: '2026',
        office: 'GOVERNOR',
        state: 'SP',
        party: 'PT',
      },
    );
    fixture.page.updateFilters({ state: 'RJ' });
    expect(fixture.navigate).toHaveBeenCalledWith([], {
      relativeTo: expect.anything(),
      queryParams: { year: 2026, office: 'GOVERNOR', state: 'RJ', party: 'PT' },
      replaceUrl: false,
    });
    fixture.navigate.mockClear();
    fixture.page.updateFilters({ state: 'SP' });
    expect(fixture.navigate).not.toHaveBeenCalled();
  });

  it('cancels stale summary and coverage responses after a filter change', () => {
    const firstSummary = new Subject<AnalyticsSummary>();
    const secondSummary = new Subject<AnalyticsSummary>();
    const firstCoverage = new Subject<AnalyticsCoverage>();
    const secondCoverage = new Subject<AnalyticsCoverage>();
    let summaryCalls = 0;
    let coverageCalls = 0;
    const fixture = setup(
      () => (++summaryCalls === 1 ? firstSummary : secondSummary),
      () => (++coverageCalls === 1 ? firstCoverage : secondCoverage),
    );
    fixture.params.next(convertToParamMap({ year: '2026', state: 'RJ' }));
    firstSummary.next(summary(99));
    firstCoverage.next(coverage(99));
    secondSummary.next(summary(1));
    secondCoverage.next(coverage(1));
    expect(fixture.page.summary()?.candidates.total).toBe(1);
    expect(fixture.page.coverage()?.candidateCount).toBe(1);
  });

  it('keeps summary visible when coverage fails and supports independent retry', () => {
    let coverageCalls = 0;
    const fixture = setup(
      () => of(summary(31_482)),
      () =>
        ++coverageCalls === 1
          ? throwError(() => new Error('coverage'))
          : of(coverage(31_482)),
    );
    expect(fixture.page.summary()?.candidates.total).toBe(31_482);
    expect(fixture.page.summaryError()).toBe(false);
    expect(fixture.page.coverageError()).toBe(true);
    fixture.page.retryCoverage();
    expect(fixture.page.coverageError()).toBe(false);
    expect(fixture.page.coverage()?.candidateCount).toBe(31_482);
  });

  it('keeps financial rankings independent and retries only the failed request', () => {
    let wealthCalls = 0;
    const fixture = setup(
      () => of(summary(1)),
      () => of(coverage(1)),
      { year: '2026' },
      () =>
        ++wealthCalls === 1
          ? throwError(() => new Error('wealth'))
          : of(wealth()),
      () => of(expenses()),
    );
    expect(fixture.page.wealthError()).toBe(true);
    expect(fixture.page.expenses()?.data[0]?.candidateId).toBe('candidate-1');
    expect(fixture.page.expensesError()).toBe(false);
    fixture.page.retryWealth();
    expect(fixture.page.wealthError()).toBe(false);
    expect(fixture.page.wealth()?.data[0]?.declaredWealth).toBe('1000.10');
    expect(fixture.expensesRequest).toHaveBeenCalledOnce();
  });

  it('cancels stale financial ranking responses after a filter change', () => {
    const firstWealth = new Subject<DeclaredWealthRanking>();
    const secondWealth = new Subject<DeclaredWealthRanking>();
    const firstExpenses = new Subject<ParliamentaryExpenseRanking>();
    const secondExpenses = new Subject<ParliamentaryExpenseRanking>();
    let wealthCalls = 0;
    let expenseCalls = 0;
    const fixture = setup(
      () => of(summary(1)),
      () => of(coverage(1)),
      { year: '2026' },
      () => (++wealthCalls === 1 ? firstWealth : secondWealth),
      () => (++expenseCalls === 1 ? firstExpenses : secondExpenses),
    );
    fixture.params.next(convertToParamMap({ year: '2026', state: 'RJ' }));
    firstWealth.next(wealth('stale'));
    firstExpenses.next(expenses('stale'));
    secondWealth.next(wealth('current'));
    secondExpenses.next(expenses('current'));
    expect(fixture.page.wealth()?.data[0]?.candidateId).toBe('current');
    expect(fixture.page.expenses()?.data[0]?.candidateId).toBe('current');
  });
});

describe('dashboard presentation helpers', () => {
  it('formats pt-BR counts and keeps zero-population percentages finite', () => {
    expect(new DashboardSummaryComponent().format.format(31_482)).toBe(
      '31.482',
    );
    const component = new DashboardCoverageComponent();
    component.coverage = coverage(0);
    expect(component.percent(10)).toBe(0);
    expect(Number.isFinite(component.percent(10))).toBe(true);
  });

  it('falls back from invalid optional URL state', () => {
    expect(
      parseDashboardFilters(
        convertToParamMap({
          year: 'x',
          office: 'invalid',
          state: 'XX',
          party: '***',
        }),
      ),
    ).toEqual({
      year: 2026,
      office: undefined,
      state: undefined,
      party: undefined,
    });
  });
});

function setup(
  summaryRequest: () => ReturnType<AnalyticsApiService['getSummary']>,
  coverageRequest: () => ReturnType<AnalyticsApiService['getCoverage']>,
  initial: Record<string, string> = { year: '2026' },
  wealthRequest: () => ReturnType<
    AnalyticsApiService['getDeclaredWealthRanking']
  > = () => of({ data: [], meta: { limit: 10 } }),
  expensesRequest: () => ReturnType<
    AnalyticsApiService['getParliamentaryExpenseRanking']
  > = () => of({ data: [], meta: { limit: 10 } }),
) {
  const params = new BehaviorSubject(convertToParamMap(initial));
  const navigate = vi.fn(async () => true);
  const route = { queryParamMap: params } as unknown as ActivatedRoute;
  const router = { navigate } as unknown as Router;
  const summaryMock = vi.fn(summaryRequest);
  const coverageMock = vi.fn(coverageRequest);
  const wealthMock = vi.fn(wealthRequest);
  const expensesMock = vi.fn(expensesRequest);
  const api = {
    getSummary: summaryMock,
    getCoverage: coverageMock,
    getDeclaredWealthRanking: wealthMock,
    getParliamentaryExpenseRanking: expensesMock,
  } as unknown as AnalyticsApiService;
  const title = { setTitle: vi.fn() } as unknown as Title;
  const page = new DashboardPageComponent(route, router, api, title);
  return {
    page,
    params,
    navigate,
    summaryRequest: summaryMock,
    coverageRequest: coverageMock,
    wealthRequest: wealthMock,
    expensesRequest: expensesMock,
  };
}
