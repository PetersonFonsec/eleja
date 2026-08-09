import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  Subject,
  catchError,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import {
  formatBrlDecimal,
  formatDateOnly,
  isUuid,
  statusLabel,
} from './candidate-formatters';
import type {
  CandidateAssetsResponse,
  CandidateDetail,
} from './candidate.types';
import { CandidatesApiService } from './candidates-api.service';
import { MAX_COMPARISON_CANDIDATES } from './candidates-page.component';

export interface CandidateComparisonItem {
  id: string;
  detail: CandidateDetail;
  assets: CandidateAssetsResponse['summary'] | null;
  assetsFailed: boolean;
}

interface ComparisonRequestResult {
  id: string;
  item: CandidateComparisonItem | null;
  missing: boolean;
}

type ComparisonState =
  | { status: 'setup' }
  | { status: 'loading' }
  | { status: 'ready'; items: CandidateComparisonItem[] }
  | { status: 'error' };

@Component({
  selector: 'app-candidate-compare-page',
  imports: [RouterLink],
  templateUrl: './candidate-compare-page.component.html',
  styleUrl: './candidate-compare-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidateComparePageComponent implements OnDestroy {
  readonly formatDateOnly = formatDateOnly;
  readonly formatBrlDecimal = formatBrlDecimal;
  readonly statusLabel = statusLabel;
  readonly state = signal<ComparisonState>({ status: 'setup' });
  readonly selectedIds = signal<string[]>([]);
  readonly invalidCount = signal(0);
  readonly missingIds = signal<string[]>([]);
  readonly failedIds = signal<string[]>([]);
  readonly imageFailures = signal<Set<string>>(new Set());
  private readonly destroyed = new Subject<void>();
  private readonly retry = new BehaviorSubject<void>(undefined);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: CandidatesApiService,
  ) {
    this.route.queryParamMap
      .pipe(
        map((params) => parseCandidateComparison(params.get('candidates'))),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        tap(({ ids, invalidCount }) => {
          this.selectedIds.set(ids);
          this.invalidCount.set(invalidCount);
          this.missingIds.set([]);
          this.failedIds.set([]);
          this.imageFailures.set(new Set());
        }),
        switchMap((selection) =>
          this.retry.pipe(
            map(() => selection),
            switchMap(({ ids }) => {
              if (ids.length < 2) {
                return of<ComparisonState>({ status: 'setup' });
              }
              this.state.set({ status: 'loading' });
              return forkJoin(ids.map((id) => this.loadCandidate(id))).pipe(
                map((results): ComparisonState => {
                  this.missingIds.set(
                    results
                      .filter((result) => result.missing)
                      .map(({ id }) => id),
                  );
                  this.failedIds.set(
                    results
                      .filter((result) => !result.item && !result.missing)
                      .map(({ id }) => id),
                  );
                  const items = results.flatMap((result) =>
                    result.item ? [result.item] : [],
                  );
                  return items.length
                    ? { status: 'ready', items }
                    : { status: 'error' };
                }),
              );
            }),
          ),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((state) => this.state.set(state));
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  retryLoad(): void {
    this.retry.next();
  }

  removeCandidate(id: string): void {
    this.navigateWithIds(
      this.selectedIds().filter((candidateId) => candidateId !== id),
    );
  }

  clearComparison(): void {
    this.navigateWithIds([]);
  }

  addCandidateRoute(): { path: string[]; queryParams: Record<string, string> } {
    return {
      path: ['/candidates'],
      queryParams: { compare: this.selectedIds().join(',') },
    };
  }

  onImageError(id: string): void {
    this.imageFailures.update((current) => new Set([...current, id]));
  }

  hasDifferentOffice(items: CandidateComparisonItem[]): boolean {
    return new Set(items.map(({ detail }) => detail.office.id)).size > 1;
  }

  hasDifferentElectionYear(items: CandidateComparisonItem[]): boolean {
    return new Set(items.map(({ detail }) => detail.election.year)).size > 1;
  }

  private loadCandidate(id: string) {
    const detailRequest = this.api.getById(id).pipe(
      map((detail) => ({ detail, error: null })),
      catchError((error: unknown) =>
        of({ detail: null, error: httpStatus(error) ?? 0 }),
      ),
    );
    const assetsRequest = this.api.getAssets(id).pipe(
      map((assets) => ({ assets, failed: false })),
      catchError(() => of({ assets: null, failed: true })),
    );
    return forkJoin({ detailRequest, assetsRequest }).pipe(
      map(({ detailRequest, assetsRequest }): ComparisonRequestResult => {
        if (!detailRequest.detail) {
          return {
            id,
            item: null,
            missing: detailRequest.error === 404,
          };
        }
        return {
          id,
          item: {
            id,
            detail: detailRequest.detail,
            assets: assetsRequest.assets?.summary ?? null,
            assetsFailed: assetsRequest.failed,
          },
          missing: false,
        };
      }),
    );
  }

  private navigateWithIds(ids: string[]): void {
    void this.router.navigate(['/compare'], {
      queryParams: { candidates: ids.length ? ids.join(',') : null },
    });
  }
}

export function parseCandidateComparison(value: string | null): {
  ids: string[];
  invalidCount: number;
} {
  const raw = (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const valid = raw.filter(isUuid);
  const ids = [...new Set(valid)].slice(0, MAX_COMPARISON_CANDIDATES);
  return { ids, invalidCount: raw.length - valid.length };
}

function httpStatus(error: unknown): number | undefined {
  return error && typeof error === 'object' && 'status' in error
    ? Number((error as { status: unknown }).status)
    : undefined;
}
