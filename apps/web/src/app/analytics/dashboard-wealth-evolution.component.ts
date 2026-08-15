import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { CandidatesApiService } from '../candidates/candidates-api.service';
import { formatBrlDecimal } from '../candidates/candidate-formatters';
import type { CandidateListItem } from '../candidates/candidate.types';
import { AnalyticsApiService } from './analytics-api.service';
import type {
  AnalyticsFilters,
  CandidateWealthHistory,
} from './analytics.types';
import {
  officeLabel,
  WealthHistoryChartComponent,
} from './wealth-history-chart.component';

@Component({
  selector: 'app-dashboard-wealth-evolution',
  imports: [RouterLink, WealthHistoryChartComponent],
  templateUrl: './dashboard-wealth-evolution.component.html',
  styleUrl: './dashboard-wealth-evolution.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardWealthEvolutionComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) filters!: AnalyticsFilters;
  readonly selected = signal<CandidateListItem | null>(null);
  readonly results = signal<CandidateListItem[]>([]);
  readonly searchLoading = signal(false);
  readonly searchError = signal(false);
  readonly searched = signal(false);
  readonly query = signal('');
  readonly history = signal<CandidateWealthHistory | null>(null);
  readonly historyLoading = signal(false);
  readonly historyError = signal(false);
  readonly money = formatBrlDecimal;
  readonly office = officeLabel;
  private readonly searchInput = new Subject<string>();
  private readonly searchRetry = new BehaviorSubject<void>(undefined);
  private readonly historySelection =
    new BehaviorSubject<CandidateListItem | null>(null);
  private readonly historyRetry = new BehaviorSubject<void>(undefined);
  private readonly destroyed = new Subject<void>();
  private searchValue = '';

  constructor(
    private readonly candidatesApi: CandidatesApiService,
    private readonly analyticsApi: AnalyticsApiService,
  ) {
    this.searchInput
      .pipe(
        debounceTime(350),
        map((value) => value.trim()),
        distinctUntilChanged(),
        switchMap((name) => {
          this.searchValue = name;
          if (name.length < 2) {
            this.searchLoading.set(false);
            this.searchError.set(false);
            this.searched.set(false);
            return of(null);
          }
          return this.searchRetry.pipe(
            tap(() => {
              this.searchLoading.set(true);
              this.searchError.set(false);
              this.searched.set(true);
              this.results.set([]);
            }),
            switchMap(() =>
              this.candidatesApi
                .list({
                  page: 1,
                  limit: 8,
                  year: this.filters.year,
                  office: this.filters.office,
                  state: this.filters.state,
                  party: this.filters.party,
                  name,
                })
                .pipe(
                  catchError(() => {
                    this.searchError.set(true);
                    return of(null);
                  }),
                ),
            ),
          );
        }),
        takeUntil(this.destroyed),
      )
      .subscribe((response) => {
        if (response) this.results.set(response.data);
        else if (!this.searchError()) this.results.set([]);
        this.searchLoading.set(false);
      });

    this.historySelection
      .pipe(
        distinctUntilChanged((a, b) => a?.id === b?.id),
        switchMap((candidate) => {
          if (!candidate) {
            this.history.set(null);
            this.historyLoading.set(false);
            this.historyError.set(false);
            return of(null);
          }
          return this.historyRetry.pipe(
            tap(() => {
              this.historyLoading.set(true);
              this.historyError.set(false);
            }),
            switchMap(() =>
              this.analyticsApi.getCandidateWealthHistory(candidate.id).pipe(
                catchError(() => {
                  this.historyError.set(true);
                  return of(null);
                }),
              ),
            ),
          );
        }),
        takeUntil(this.destroyed),
      )
      .subscribe((history) => {
        if (history)
          this.history.set({
            ...history,
            data: [...history.data].sort(
              (a, b) => a.electionYear - b.electionYear,
            ),
          });
        this.historyLoading.set(false);
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters'] && !changes['filters'].firstChange)
      this.clearSelection();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  search(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.searchInput.next(value);
  }

  retrySearch(): void {
    if (this.searchValue.length >= 2) this.searchRetry.next();
  }

  choose(candidate: CandidateListItem): void {
    if (candidate.id === this.selected()?.id) return;
    this.selected.set(candidate);
    this.results.set([]);
    this.searched.set(false);
    this.history.set(null);
    this.historySelection.next(candidate);
  }

  retryHistory(): void {
    this.historyRetry.next();
  }

  private clearSelection(): void {
    this.selected.set(null);
    this.results.set([]);
    this.searched.set(false);
    this.searchLoading.set(false);
    this.searchError.set(false);
    this.searchValue = '';
    this.query.set('');
    this.searchInput.next('');
    this.historySelection.next(null);
  }
}
