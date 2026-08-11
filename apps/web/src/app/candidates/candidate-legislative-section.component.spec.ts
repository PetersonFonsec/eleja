import '@angular/compiler';
import { of, Subject, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type {
  CandidateLegislativeProfile,
  ExpenseResponse,
  ProposalResponse,
  VoteResponse,
} from './candidate.types';
import { CandidateLegislativeSectionComponent } from './candidate-legislative-section.component';
import { formatDateTime, votePositionLabel } from './candidate-formatters';
import { CandidatesApiService } from './candidates-api.service';

const ID = '93280ad8-b089-46cc-9848-91462ff63e7c';
const profile: CandidateLegislativeProfile = {
  candidateId: ID,
  hasLegislativeHistory: true,
  summary: {
    mandates: 2,
    proposals: 45,
    primaryAuthoredProposals: 12,
    votes: 321,
    expenses: { count: 846, totalNetValue: '2945831.42' },
  },
  currentOrLatestMandate: null,
};
const page = { page: 1, limit: 10, total: 0, totalPages: 0 };

describe('CandidateLegislativeSectionComponent', () => {
  it('loads only the profile initially and supports a neutral no-history state', () => {
    const fixture = setup({ noHistory: true });
    fixture.component.candidateId = ID;

    expect(fixture.api.getLegislativeProfile).toHaveBeenCalledWith(ID);
    expect(fixture.api.getMandates).not.toHaveBeenCalled();
    expect(fixture.api.getProposals).not.toHaveBeenCalled();
    expect(fixture.api.getVotes).not.toHaveBeenCalled();
    expect(fixture.api.getExpenses).not.toHaveBeenCalled();
    expect(fixture.component.profile()).toEqual({
      ...profile,
      hasLegislativeHistory: false,
    });
  });

  it('exposes the complete overview summary without loading list endpoints', () => {
    const fixture = setup();
    fixture.component.candidateId = ID;

    expect(fixture.component.profile()?.summary).toEqual(profile.summary);
    expect(fixture.api.getProposals).not.toHaveBeenCalled();
    expect(fixture.api.getVotes).not.toHaveBeenCalled();
    expect(fixture.api.getExpenses).not.toHaveBeenCalled();
  });

  it('lazy-loads each large section once and keeps failures isolated', () => {
    const fixture = setup({ proposalsError: true });
    fixture.component.candidateId = ID;

    fixture.component.selectTab('proposals');
    fixture.component.selectTab('proposals');
    expect(fixture.api.getProposals).toHaveBeenCalledOnce();
    expect(fixture.component.proposalsState().status).toBe('error');
    expect(fixture.component.profileState().status).toBe('ready');

    fixture.component.selectTab('mandates');
    fixture.component.selectTab('votes');
    fixture.component.selectTab('expenses');
    expect(fixture.api.getMandates).toHaveBeenCalledOnce();
    expect(fixture.api.getVotes).toHaveBeenCalledOnce();
    expect(fixture.api.getExpenses).toHaveBeenCalledOnce();
  });

  it('resets pagination and forwards proposal, vote, and expense filters', () => {
    const fixture = setup();
    const component = fixture.component;
    component.candidateId = ID;
    component.proposalFilters = {
      type: 'PL',
      year: '2024',
      primaryAuthor: 'false',
    };
    component.voteFilters = { year: '2023', position: 'ABSTENTION' };
    component.expenseFilters = {
      year: '2022',
      month: '7',
      category: 'Passagens',
    };

    component.loadProposals(1);
    component.loadVotes(1);
    component.loadExpenses(1);

    expect(fixture.api.getProposals).toHaveBeenLastCalledWith(ID, {
      page: 1,
      limit: 10,
      type: 'PL',
      year: 2024,
      primaryAuthor: false,
    });
    expect(fixture.api.getVotes).toHaveBeenLastCalledWith(ID, {
      page: 1,
      limit: 10,
      year: 2023,
      position: 'ABSTENTION',
    });
    expect(fixture.api.getExpenses).toHaveBeenLastCalledWith(ID, {
      page: 1,
      limit: 10,
      year: 2022,
      month: 7,
      category: 'Passagens',
    });
  });

  it('keeps the newest proposal response when filters change', () => {
    const first = new Subject<ProposalResponse>();
    const second = new Subject<ProposalResponse>();
    let calls = 0;
    const fixture = setup({
      proposals: () => (++calls === 1 ? first : second),
    });
    fixture.component.candidateId = ID;
    fixture.component.loadProposals(2);
    fixture.component.loadProposals(1);

    const newer = {
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    };
    second.next(newer);
    first.next({
      data: [],
      meta: { page: 2, limit: 10, total: 11, totalPages: 2 },
    });
    expect(fixture.component.proposalsState()).toEqual({
      status: 'ready',
      data: newer,
    });
  });
});

describe('legislative formatters', () => {
  it('formats official timestamps safely and preserves neutral vote semantics', () => {
    expect(formatDateTime('2024-05-14T22:30:00Z')).toBe('14/05/2024 às 22:30');
    expect(votePositionLabel('YES')).toBe('Sim');
    expect(votePositionLabel('OBSTRUCTION')).toBe('Obstrução');
    expect(votePositionLabel('UNKNOWN')).toBe('Não informado');
  });
});

function setup(options?: {
  noHistory?: boolean;
  proposalsError?: boolean;
  proposals?: () => Subject<ProposalResponse>;
}) {
  const proposalResponse: ProposalResponse = { data: [], meta: page };
  const voteResponse: VoteResponse = { data: [], meta: page };
  const expenseResponse: ExpenseResponse = {
    data: [],
    meta: page,
    summary: { totalNetValue: '0.00' },
  };
  const api = {
    getLegislativeProfile: vi.fn(() =>
      of({ ...profile, hasLegislativeHistory: !options?.noHistory }),
    ),
    getMandates: vi.fn(() => of([])),
    getProposals: vi.fn(() =>
      options?.proposals
        ? options.proposals()
        : options?.proposalsError
          ? throwError(() => new Error('failed'))
          : of(proposalResponse),
    ),
    getVotes: vi.fn(() => of(voteResponse)),
    getExpenses: vi.fn(() => of(expenseResponse)),
  };
  return {
    api,
    component: new CandidateLegislativeSectionComponent(
      api as unknown as CandidatesApiService,
    ),
  };
}
