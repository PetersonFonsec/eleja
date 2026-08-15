import '@angular/compiler';
import { SimpleChange } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CandidatesApiService } from '../candidates/candidates-api.service';
import type {
  CandidateListItem,
  CandidateListQuery,
} from '../candidates/candidate.types';
import { AnalyticsApiService } from './analytics-api.service';
import type { CandidateWealthHistory } from './analytics.types';
import { DashboardWealthEvolutionComponent } from './dashboard-wealth-evolution.component';
import {
  compactBrl,
  WealthHistoryChartComponent,
} from './wealth-history-chart.component';

const candidate = (id: string): CandidateListItem => ({
  id,
  name: `Nome completo ${id}`,
  ballotName: `Candidato ${id}`,
  ballotNumber: 10,
  photoUrl: null,
  status: 'ACTIVE',
  state: 'SP',
  city: null,
  party: { id: 'party', name: 'Partido', acronym: 'ABC', number: 10 },
  office: {
    id: 'office',
    code: 'GOVERNOR',
    name: 'Governador',
    scope: 'STATE',
  },
  election: { id: 'election', year: 2026, type: 'GENERAL', round: 1 },
});

const history = (
  id: string,
  years = [2018, 2022, 2026],
): CandidateWealthHistory => ({
  candidateId: id,
  personId: 'person',
  hasHistoricalSeries: years.length >= 2,
  data: years.map((year, index) => ({
    candidateId: `${id}-${year}`,
    electionYear: year,
    electionType: 'GENERAL',
    officeCode: index === 0 ? 'STATE_DEPUTY' : 'GOVERNOR',
    state: 'SP',
    assetCount: index + 1,
    declaredWealth: ['620000.00', '1100000.00', '1900000.00'][index] ?? '0.01',
  })),
});

afterEach(() => vi.useRealTimers());

describe('DashboardWealthEvolutionComponent', () => {
  it('debounces search and applies all current dashboard filters', async () => {
    vi.useFakeTimers();
    const fixture = setup();
    fixture.component.search(inputEvent('j'));
    fixture.component.search(inputEvent('joao'));
    expect(fixture.list).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(349);
    expect(fixture.list).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fixture.list).toHaveBeenCalledOnce();
    expect(fixture.list).toHaveBeenCalledWith({
      page: 1,
      limit: 8,
      year: 2026,
      office: 'GOVERNOR',
      state: 'SP',
      party: 'ABC',
      name: 'joao',
    });
  });

  it('loads a selected candidate once and preserves missing election years', () => {
    const fixture = setup(undefined, () => of(history('A', [2018, 2026])));
    fixture.component.choose(candidate('A'));
    expect(fixture.getHistory).toHaveBeenCalledOnce();
    expect(fixture.getHistory).toHaveBeenCalledWith('A');
    expect(
      fixture.component.history()?.data.map((point) => point.electionYear),
    ).toEqual([2018, 2026]);
    expect(
      fixture.component
        .history()
        ?.data.some((point) => point.electionYear === 2022),
    ).toBe(false);
    fixture.component.choose(candidate('A'));
    expect(fixture.getHistory).toHaveBeenCalledOnce();
  });

  it('does not allow an older search response to replace a newer term', async () => {
    vi.useFakeTimers();
    const first = new Subject<{
      data: CandidateListItem[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>();
    const second = new Subject<{
      data: CandidateListItem[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>();
    const fixture = setup((query) => (query.name === 'joao' ? first : second));
    fixture.component.search(inputEvent('joao'));
    await vi.advanceTimersByTimeAsync(350);
    fixture.component.search(inputEvent('maria'));
    await vi.advanceTimersByTimeAsync(350);
    second.next({ data: [candidate('B')], meta: pageMeta() });
    first.next({ data: [candidate('A')], meta: pageMeta() });
    expect(fixture.component.results().map((item) => item.id)).toEqual(['B']);
  });

  it('prevents a slow previous candidate response from replacing the current one', () => {
    const first = new Subject<CandidateWealthHistory>();
    const second = new Subject<CandidateWealthHistory>();
    const fixture = setup(undefined, (id) => (id === 'A' ? first : second));
    fixture.component.choose(candidate('A'));
    fixture.component.choose(candidate('B'));
    second.next(history('B'));
    first.next(history('A'));
    expect(fixture.component.history()?.candidateId).toBe('B');
  });

  it('isolates a history error, retries it, and clears selection on filter change', () => {
    let calls = 0;
    const fixture = setup(undefined, () =>
      ++calls === 1 ? throwError(() => new Error('history')) : of(history('A')),
    );
    fixture.component.choose(candidate('A'));
    expect(fixture.component.historyError()).toBe(true);
    fixture.component.retryHistory();
    expect(fixture.component.historyError()).toBe(false);
    expect(fixture.component.history()?.candidateId).toBe('A');
    fixture.component.filters = { year: 2026, state: 'RJ' };
    fixture.component.ngOnChanges({
      filters: new SimpleChange(
        { year: 2026, state: 'SP' },
        fixture.component.filters,
        false,
      ),
    });
    expect(fixture.component.selected()).toBeNull();
    expect(fixture.component.history()).toBeNull();
  });
});

describe('WealthHistoryChartComponent', () => {
  it('sorts points without interpolating missing years and keeps exact money display', () => {
    const chart = new WealthHistoryChartComponent();
    chart.points = history('A', [2026, 2018]).data;
    expect(chart.plot().map((point) => point.electionYear)).toEqual([
      2018, 2026,
    ]);
    expect(chart.plot()).toHaveLength(2);
    expect(chart.money('0.01')).toBe('R$ 0,01');
    expect(chart.money('1000.10')).toBe('R$ 1.000,10');
    expect(chart.money('1000000.00')).toBe('R$ 1.000.000,00');
    expect(chart.money('999999999.99')).toBe('R$ 999.999.999,99');
    expect(compactBrl(1_500_000)).toBe('R$ 1,5 mi');
  });
});

function setup(
  listResult: (
    query: CandidateListQuery,
  ) => ReturnType<CandidatesApiService['list']> = () =>
    of({ data: [], meta: { page: 1, limit: 8, total: 0, totalPages: 0 } }),
  historyResult: (
    id: string,
  ) => ReturnType<AnalyticsApiService['getCandidateWealthHistory']> = (id) =>
    of(history(id)),
) {
  const list = vi.fn(listResult);
  const getHistory = vi.fn(historyResult);
  const component = new DashboardWealthEvolutionComponent(
    { list } as unknown as CandidatesApiService,
    { getCandidateWealthHistory: getHistory } as unknown as AnalyticsApiService,
  );
  component.filters = {
    year: 2026,
    office: 'GOVERNOR',
    state: 'SP',
    party: 'ABC',
  };
  return { component, list, getHistory };
}

function inputEvent(value: string): Event {
  return { target: { value } } as unknown as Event;
}

function pageMeta() {
  return { page: 1, limit: 8, total: 1, totalPages: 1 };
}
