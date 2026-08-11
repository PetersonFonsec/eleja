import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BehaviorSubject,
  Subject,
  catchError,
  filter,
  map,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import type {
  CandidateLegislativeProfile,
  ExpenseQuery,
  ExpenseResponse,
  LegislativeMandate,
  ProposalQuery,
  ProposalResponse,
  VoteQuery,
  VoteResponse,
} from './candidate.types';
import {
  formatBrlDecimal,
  formatDateOnly,
  formatDateTime,
  legislativeBodyLabel,
  legislativeStatusLabel,
  votePositionLabel,
  votingResultLabel,
} from './candidate-formatters';
import { CandidatesApiService } from './candidates-api.service';

type Tab = 'overview' | 'mandates' | 'proposals' | 'votes' | 'expenses';
type State<T> =
  { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; data: T };

@Component({
  selector: 'app-candidate-legislative-section',
  imports: [FormsModule],
  templateUrl: './candidate-legislative-section.component.html',
  styleUrl: './candidate-legislative-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidateLegislativeSectionComponent implements OnDestroy {
  readonly tabs: ReadonlyArray<readonly [Tab, string]> = [
    ['overview', 'Visão geral'],
    ['mandates', 'Mandatos'],
    ['proposals', 'Proposições'],
    ['votes', 'Votações'],
    ['expenses', 'Gastos'],
  ];
  @Input({ required: true })
  set candidateId(id: string) {
    if (id === this.currentCandidateId) return;
    this.candidateChanged.next();
    this.currentCandidateId = id;
    this.reset();
    this.profileRequests.next(id);
  }
  readonly activeTab = signal<Tab>('overview');
  readonly profileState = signal<State<CandidateLegislativeProfile>>({
    status: 'idle',
  });
  readonly mandatesState = signal<State<LegislativeMandate[]>>({
    status: 'idle',
  });
  readonly proposalsState = signal<State<ProposalResponse>>({ status: 'idle' });
  readonly votesState = signal<State<VoteResponse>>({ status: 'idle' });
  readonly expensesState = signal<State<ExpenseResponse>>({ status: 'idle' });
  readonly formatBrlDecimal = formatBrlDecimal;
  readonly formatDateOnly = formatDateOnly;
  readonly formatDateTime = formatDateTime;
  readonly legislativeBodyLabel = legislativeBodyLabel;
  readonly legislativeStatusLabel = legislativeStatusLabel;
  readonly votePositionLabel = votePositionLabel;
  readonly votingResultLabel = votingResultLabel;
  proposalFilters: { type: string; year: string; primaryAuthor: string } = {
    type: '',
    year: '',
    primaryAuthor: '',
  };
  voteFilters: { year: string; position: string } = { year: '', position: '' };
  expenseFilters: { year: string; month: string; category: string } = {
    year: '',
    month: '',
    category: '',
  };
  private readonly destroyed = new Subject<void>();
  private readonly candidateChanged = new Subject<void>();
  private readonly profileRequests = new BehaviorSubject<string>('');
  private readonly mandateRequests = new BehaviorSubject<string>('');
  private readonly proposalRequests = new Subject<ProposalQuery>();
  private readonly voteRequests = new Subject<VoteQuery>();
  private readonly expenseRequests = new Subject<ExpenseQuery>();
  private currentCandidateId = '';

  constructor(private readonly api: CandidatesApiService) {
    this.profileRequests
      .pipe(
        filter(Boolean),
        tap(() => this.profileState.set({ status: 'loading' })),
        switchMap((id) =>
          this.api.getLegislativeProfile(id).pipe(
            map((data) => ({ status: 'ready', data }) as const),
            catchError(() => of({ status: 'error' } as const)),
          ),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((state) => this.profileState.set(state));
    this.mandateRequests
      .pipe(
        filter(Boolean),
        tap(() => this.mandatesState.set({ status: 'loading' })),
        switchMap((id) =>
          this.api.getMandates(id).pipe(
            takeUntil(this.candidateChanged),
            map((data) => ({ status: 'ready', data }) as const),
            catchError(() => of({ status: 'error' } as const)),
          ),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((state) => this.mandatesState.set(state));
    this.proposalRequests
      .pipe(
        tap(() => this.proposalsState.set({ status: 'loading' })),
        switchMap((query) =>
          this.api.getProposals(this.currentCandidateId, query).pipe(
            takeUntil(this.candidateChanged),
            map((data) => ({ status: 'ready', data }) as const),
            catchError(() => of({ status: 'error' } as const)),
          ),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((state) => this.proposalsState.set(state));
    this.voteRequests
      .pipe(
        tap(() => this.votesState.set({ status: 'loading' })),
        switchMap((query) =>
          this.api.getVotes(this.currentCandidateId, query).pipe(
            takeUntil(this.candidateChanged),
            map((data) => ({ status: 'ready', data }) as const),
            catchError(() => of({ status: 'error' } as const)),
          ),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((state) => this.votesState.set(state));
    this.expenseRequests
      .pipe(
        tap(() => this.expensesState.set({ status: 'loading' })),
        switchMap((query) =>
          this.api.getExpenses(this.currentCandidateId, query).pipe(
            takeUntil(this.candidateChanged),
            map((data) => ({ status: 'ready', data }) as const),
            catchError(() => of({ status: 'error' } as const)),
          ),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((state) => this.expensesState.set(state));
  }
  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }
  selectTab(tab: Tab) {
    this.activeTab.set(tab);
    if (tab === 'mandates' && this.mandatesState().status === 'idle')
      this.retryMandates();
    if (tab === 'proposals' && this.proposalsState().status === 'idle')
      this.loadProposals(1);
    if (tab === 'votes' && this.votesState().status === 'idle')
      this.loadVotes(1);
    if (tab === 'expenses' && this.expensesState().status === 'idle')
      this.loadExpenses(1);
  }
  retryProfile() {
    this.profileRequests.next(this.currentCandidateId);
  }
  retryMandates() {
    this.mandateRequests.next(this.currentCandidateId);
  }
  loadProposals(page: number) {
    this.proposalRequests.next({
      page,
      limit: 10,
      type: optional(this.proposalFilters.type),
      year: number(this.proposalFilters.year),
      primaryAuthor: bool(this.proposalFilters.primaryAuthor),
    });
  }
  loadVotes(page: number) {
    this.voteRequests.next({
      page,
      limit: 10,
      year: number(this.voteFilters.year),
      position: optional(this.voteFilters.position),
    });
  }
  loadExpenses(page: number) {
    this.expenseRequests.next({
      page,
      limit: 10,
      year: number(this.expenseFilters.year),
      month: number(this.expenseFilters.month),
      category: optional(this.expenseFilters.category),
    });
  }
  profile(): CandidateLegislativeProfile | null {
    const state = this.profileState();
    return state.status === 'ready' ? state.data : null;
  }
  private reset() {
    this.activeTab.set('overview');
    this.profileState.set({ status: 'idle' });
    this.mandatesState.set({ status: 'idle' });
    this.proposalsState.set({ status: 'idle' });
    this.votesState.set({ status: 'idle' });
    this.expensesState.set({ status: 'idle' });
  }
}
function optional(value: string): string | undefined {
  return value.trim() || undefined;
}
function number(value: string): number | undefined {
  return value ? Number(value) : undefined;
}
function bool(value: string): boolean | undefined {
  return value === 'true' ? true : value === 'false' ? false : undefined;
}
