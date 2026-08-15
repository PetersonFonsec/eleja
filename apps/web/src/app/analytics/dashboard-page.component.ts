import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  Subject,
  catchError,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { AnalyticsApiService } from './analytics-api.service';
import type {
  AnalyticsCoverage,
  AnalyticsFilters,
  AnalyticsSummary,
  DeclaredWealthRanking,
  LegislativeAnalytics,
  ParliamentaryExpenseRanking,
} from './analytics.types';
import { DashboardCoverageComponent } from './dashboard-coverage.component';
import { DashboardFinancialRankingsComponent } from './dashboard-financial-rankings.component';
import { DashboardLegislativeComponent } from './dashboard-legislative.component';
import {
  DashboardFiltersComponent,
  DASHBOARD_OFFICES,
  DASHBOARD_STATES,
} from './dashboard-filters.component';
import { DashboardSummaryComponent } from './dashboard-summary.component';
import { DashboardWealthEvolutionComponent } from './dashboard-wealth-evolution.component';

const DEFAULT_YEAR = 2026;

@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    DashboardFiltersComponent,
    DashboardSummaryComponent,
    DashboardCoverageComponent,
    DashboardFinancialRankingsComponent,
    DashboardWealthEvolutionComponent,
    DashboardLegislativeComponent,
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnDestroy {
  readonly filters = signal<AnalyticsFilters>({ year: DEFAULT_YEAR });
  readonly summary = signal<AnalyticsSummary | null>(null);
  readonly summaryLoading = signal(true);
  readonly summaryError = signal(false);
  readonly coverage = signal<AnalyticsCoverage | null>(null);
  readonly coverageLoading = signal(true);
  readonly coverageError = signal(false);
  readonly wealth = signal<DeclaredWealthRanking | null>(null);
  readonly wealthLoading = signal(true);
  readonly wealthError = signal(false);
  readonly expenses = signal<ParliamentaryExpenseRanking | null>(null);
  readonly expensesLoading = signal(true);
  readonly expensesError = signal(false);
  readonly legislative = signal<LegislativeAnalytics | null>(null);
  readonly legislativeLoading = signal(true);
  readonly legislativeError = signal(false);
  private readonly destroyed = new Subject<void>();
  private readonly summaryRetry = new BehaviorSubject<void>(undefined);
  private readonly coverageRetry = new BehaviorSubject<void>(undefined);
  private readonly wealthRetry = new BehaviorSubject<void>(undefined);
  private readonly expensesRetry = new BehaviorSubject<void>(undefined);
  private readonly legislativeRetry = new BehaviorSubject<void>(undefined);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: AnalyticsApiService,
    title: Title,
  ) {
    title.setTitle('Panorama Eleitoral | Eleja');
    const filterState = this.route.queryParamMap.pipe(
      map(parseDashboardFilters),
      distinctUntilChanged(equalFilters),
      tap((filters) => this.filters.set(filters)),
    );
    filterState
      .pipe(
        switchMap((filters) => this.summaryRetry.pipe(map(() => filters))),
        tap(() => {
          this.summaryLoading.set(true);
          this.summaryError.set(false);
        }),
        switchMap((filters) =>
          this.api.getSummary(filters).pipe(
            catchError(() => {
              this.summaryError.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((summary) => {
        if (summary) this.summary.set(summary);
        this.summaryLoading.set(false);
      });
    filterState
      .pipe(
        switchMap((filters) => this.coverageRetry.pipe(map(() => filters))),
        tap(() => {
          this.coverageLoading.set(true);
          this.coverageError.set(false);
        }),
        switchMap((filters) =>
          this.api.getCoverage(filters).pipe(
            catchError(() => {
              this.coverageError.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((coverage) => {
        if (coverage) this.coverage.set(coverage);
        this.coverageLoading.set(false);
      });
    filterState
      .pipe(
        switchMap((filters) => this.wealthRetry.pipe(map(() => filters))),
        tap(() => {
          this.wealthLoading.set(true);
          this.wealthError.set(false);
        }),
        switchMap((filters) =>
          this.api.getDeclaredWealthRanking(filters, 10).pipe(
            catchError(() => {
              this.wealthError.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((ranking) => {
        if (ranking) this.wealth.set(ranking);
        this.wealthLoading.set(false);
      });
    filterState
      .pipe(
        switchMap((filters) => this.expensesRetry.pipe(map(() => filters))),
        tap(() => {
          this.expensesLoading.set(true);
          this.expensesError.set(false);
        }),
        switchMap((filters) =>
          this.api.getParliamentaryExpenseRanking(filters, 10).pipe(
            catchError(() => {
              this.expensesError.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((ranking) => {
        if (ranking) this.expenses.set(ranking);
        this.expensesLoading.set(false);
      });
    filterState
      .pipe(
        switchMap((filters) => this.legislativeRetry.pipe(map(() => filters))),
        tap(() => {
          this.legislativeLoading.set(true);
          this.legislativeError.set(false);
        }),
        switchMap((filters) =>
          this.api.getLegislativeAnalytics(filters).pipe(
            catchError(() => {
              this.legislativeError.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((analytics) => {
        if (analytics) this.legislative.set(analytics);
        this.legislativeLoading.set(false);
      });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  updateFilters(update: Partial<AnalyticsFilters>): void {
    const current = this.filters();
    const next = { ...current, ...update };
    if (equalFilters(current, next)) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        year: next.year,
        office: next.office ?? null,
        state: next.state ?? null,
        party: next.party ?? null,
      },
      replaceUrl: false,
    });
  }
  retrySummary(): void {
    this.summaryRetry.next();
  }
  retryCoverage(): void {
    this.coverageRetry.next();
  }
  retryWealth(): void {
    this.wealthRetry.next();
  }
  retryExpenses(): void {
    this.expensesRetry.next();
  }
  retryLegislative(): void {
    this.legislativeRetry.next();
  }
}

export function parseDashboardFilters(params: ParamMap): AnalyticsFilters {
  const parsedYear = Number(params.get('year'));
  const year =
    Number.isSafeInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= 9999
      ? parsedYear
      : DEFAULT_YEAR;
  const officeValue = params.get('office')?.trim().toUpperCase();
  const office = DASHBOARD_OFFICES.some(([code]) => code === officeValue)
    ? officeValue
    : undefined;
  const stateValue = params.get('state')?.trim().toUpperCase();
  const state = DASHBOARD_STATES.includes(stateValue as never)
    ? stateValue
    : undefined;
  const partyValue = params.get('party')?.trim().toUpperCase();
  const party =
    partyValue && /^[A-Z0-9-]{1,20}$/.test(partyValue) ? partyValue : undefined;
  return { year, office, state, party };
}

function equalFilters(a: AnalyticsFilters, b: AnalyticsFilters): boolean {
  return (
    a.year === b.year &&
    a.office === b.office &&
    a.state === b.state &&
    a.party === b.party
  );
}
