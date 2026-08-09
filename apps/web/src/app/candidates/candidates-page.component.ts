import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  signal,
} from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
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
import { CandidateCardComponent } from './candidate-card.component';
import type {
  CandidateListQuery,
  CandidateListResponse,
  PaginationMeta,
} from './candidate.types';
import { CandidatesApiService } from './candidates-api.service';

const LIMIT = 20;
const EMPTY_META: PaginationMeta = {
  page: 1,
  limit: LIMIT,
  total: 0,
  totalPages: 0,
};

export const OFFICES = [
  ['PRESIDENT', 'Presidente'],
  ['GOVERNOR', 'Governador'],
  ['SENATOR', 'Senador'],
  ['FEDERAL_DEPUTY', 'Deputado Federal'],
  ['STATE_DEPUTY', 'Deputado Estadual'],
] as const;
export const STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

@Component({
  selector: 'app-candidates-page',
  imports: [CandidateCardComponent],
  templateUrl: './candidates-page.component.html',
  styleUrl: './candidates-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidatesPageComponent implements OnDestroy {
  readonly offices = OFFICES;
  readonly states = STATES;
  readonly response = signal<CandidateListResponse>({
    data: [],
    meta: EMPTY_META,
  });
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly filtersOpen = signal(false);
  readonly query = signal<CandidateListQuery>({
    page: 1,
    limit: LIMIT,
    year: 2026,
  });
  private readonly destroyed = new Subject<void>();
  private readonly retry = new BehaviorSubject<void>(undefined);
  private readonly search = new Subject<string>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: CandidatesApiService,
  ) {
    this.search
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        takeUntil(this.destroyed),
      )
      .subscribe((name) =>
        this.updateFilters({ name: name.trim() || undefined }),
      );
    this.route.queryParamMap
      .pipe(
        map(parseQuery),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        tap((query) => this.query.set(query)),
        switchMap((query) => this.retry.pipe(map(() => query))),
        tap(() => {
          this.loading.set(true);
          this.error.set(false);
        }),
        switchMap((query) =>
          this.api.list(query).pipe(
            catchError(() => {
              this.error.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((response) => {
        if (response) this.response.set(response);
        this.loading.set(false);
      });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }
  onSearch(value: string): void {
    this.search.next(value);
  }
  onFilter(key: 'year' | 'office' | 'state' | 'party', value: string): void {
    const normalized = value.trim();
    this.updateFilters({
      [key]: key === 'year' ? Number(normalized) : normalized || undefined,
    });
  }
  goToPage(page: number): void {
    if (
      page < 1 ||
      page > this.response().meta.totalPages ||
      page === this.query().page
    )
      return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
  }
  retryLoad(): void {
    this.retry.next();
  }
  clearFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { year: 2026 },
    });
  }
  visiblePages(): number[] {
    const { page, totalPages } = this.response().meta;
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    return Array.from(
      { length: Math.min(5, totalPages) },
      (_, index) => start + index,
    );
  }
  resultSummary(): string {
    const { page, limit, total } = this.response().meta;
    if (!total) return 'Nenhum candidato encontrado';
    const first = (page - 1) * limit + 1;
    return `Mostrando ${first.toLocaleString('pt-BR')}–${Math.min(page * limit, total).toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`;
  }
  private updateFilters(values: Partial<CandidateListQuery>): void {
    const queryParams: Record<string, string | number | null | undefined> = {
      ...values,
      page: null,
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}

export function parseQuery(params: ParamMap): CandidateListQuery {
  const positive = (name: string, fallback: number) => {
    const value = Number(params.get(name));
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  };
  const optional = (name: string) => params.get(name)?.trim() || undefined;
  return {
    page: positive('page', 1),
    limit: LIMIT,
    year: positive('year', 2026),
    office: optional('office')?.toUpperCase(),
    state: optional('state')?.toUpperCase(),
    party: optional('party')?.toUpperCase(),
    name: optional('name'),
  };
}
