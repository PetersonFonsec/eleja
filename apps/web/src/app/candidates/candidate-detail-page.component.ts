import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import type {
  CandidateAssetsResponse,
  CandidateDetail,
} from './candidate.types';
import { CandidatesApiService } from './candidates-api.service';

type CandidateState =
  | { status: 'loading' }
  | { status: 'ready'; data: CandidateDetail }
  | { status: 'invalid' | 'not-found' | 'error' };
type AssetsState =
  | { status: 'idle' | 'loading' | 'error' }
  | { status: 'ready'; data: CandidateAssetsResponse };

@Component({
  selector: 'app-candidate-detail-page',
  imports: [RouterLink],
  templateUrl: './candidate-detail-page.component.html',
  styleUrl: './candidate-detail-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidateDetailPageComponent implements OnDestroy {
  readonly formatDateOnly = formatDateOnly;
  readonly formatBrlDecimal = formatBrlDecimal;
  readonly electionTypeLabel = electionTypeLabel;
  readonly statusLabel = statusLabel;
  readonly candidateState = signal<CandidateState>({ status: 'loading' });
  readonly assetsState = signal<AssetsState>({ status: 'idle' });
  readonly imageFailed = signal(false);
  private readonly destroyed = new Subject<void>();
  private readonly candidateRetry = new BehaviorSubject<void>(undefined);
  private readonly assetsRetry = new BehaviorSubject<void>(undefined);
  private readonly id$: Observable<string>;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: CandidatesApiService,
  ) {
    this.id$ = this.route.paramMap.pipe(
      map((params) => params.get('id') ?? ''),
      distinctUntilChanged(),
    );
    this.id$
      .pipe(
        switchMap((id) =>
          this.candidateRetry.pipe(
            map(() => id),
            tap(() => {
              this.imageFailed.set(false);
              this.candidateState.set({ status: 'loading' });
            }),
            switchMap((candidateId) => {
              if (!isUuid(candidateId)) {
                return of<CandidateState>({ status: 'invalid' });
              }
              return this.api.getById(candidateId).pipe(
                map((data): CandidateState => ({ status: 'ready', data })),
                catchError((error: unknown) =>
                  of<CandidateState>({
                    status: httpStatus(error) === 404 ? 'not-found' : 'error',
                  }),
                ),
              );
            }),
          ),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((state) => this.candidateState.set(state));

    this.id$
      .pipe(
        switchMap((id) =>
          this.assetsRetry.pipe(
            map(() => id),
            tap(() =>
              this.assetsState.set({
                status: isUuid(id) ? 'loading' : 'idle',
              }),
            ),
            switchMap((candidateId) => {
              if (!isUuid(candidateId)) {
                return of<AssetsState>({ status: 'idle' });
              }
              return this.api.getAssets(candidateId).pipe(
                map((data): AssetsState => ({ status: 'ready', data })),
                catchError(() => of<AssetsState>({ status: 'error' })),
              );
            }),
          ),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((state) => this.assetsState.set(state));
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  retryCandidate(): void {
    this.candidateRetry.next();
  }
  retryAssets(): void {
    this.assetsRetry.next();
  }
  onImageError(): void {
    this.imageFailed.set(true);
  }

  assetData(): CandidateAssetsResponse | null {
    const state = this.assetsState();
    return state.status === 'ready' ? state.data : null;
  }
}

export function formatDateOnly(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function formatBrlDecimal(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d{2}))$/.exec(value);
  if (!match) return value;
  const [, sign, integer, fraction] = match;
  const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${sign}${grouped},${fraction}`;
}

export function electionTypeLabel(value: string): string {
  return value === 'GENERAL'
    ? 'Eleição Geral'
    : value === 'MUNICIPAL'
      ? 'Eleição Municipal'
      : value;
}

export function statusLabel(value: string): string {
  if (value === 'ACTIVE') return 'Ativa';
  if (value === 'INACTIVE') return 'Inativa';
  return 'Não informada';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function httpStatus(error: unknown): number | undefined {
  return error && typeof error === 'object' && 'status' in error
    ? Number((error as { status: unknown }).status)
    : undefined;
}
