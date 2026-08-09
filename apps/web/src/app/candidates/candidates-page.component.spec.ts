import '@angular/compiler';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { CandidateListResponse } from './candidate.types';
import { CandidatesApiService } from './candidates-api.service';
import {
  CandidatesPageComponent,
  parseQuery,
} from './candidates-page.component';

const empty: CandidateListResponse = {
  data: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

describe('CandidatesPageComponent', () => {
  it('represents loading, success, empty and error states', () => {
    const pending = new Subject<CandidateListResponse>();
    const fixture = setup(() => pending);
    expect(fixture.page.loading()).toBe(true);

    pending.next(empty);
    expect(fixture.page.loading()).toBe(false);
    expect(fixture.page.response().meta.total).toBe(0);

    const failed = setup(() => throwError(() => new Error('network')));
    expect(failed.page.loading()).toBe(false);
    expect(failed.page.error()).toBe(true);
  });

  it('debounces search and resets the page', async () => {
    vi.useFakeTimers();
    const fixture = setup(() => of(empty));

    fixture.page.onSearch('Maria');
    await vi.advanceTimersByTimeAsync(399);
    expect(fixture.navigate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fixture.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { name: 'Maria', page: null },
      }),
    );
    vi.useRealTimers();
  });

  it('updates office, state, party and pagination through URL params', () => {
    const fixture = setup(() =>
      of({ ...empty, meta: { ...empty.meta, total: 100, totalPages: 5 } }),
    );
    fixture.page.onFilter('office', 'FEDERAL_DEPUTY');
    fixture.page.onFilter('state', 'SP');
    fixture.page.onFilter('party', 'PT');
    fixture.page.goToPage(2);

    expect(
      fixture.navigate.mock.calls.map((call) => call[1]?.queryParams),
    ).toEqual([
      { office: 'FEDERAL_DEPUTY', page: null },
      { state: 'SP', page: null },
      { party: 'PT', page: null },
      { page: 2 },
    ]);
  });

  it('cancels stale requests when query parameters change', () => {
    const first = new Subject<CandidateListResponse>();
    const second = new Subject<CandidateListResponse>();
    let calls = 0;
    const fixture = setup(() => (++calls === 1 ? first : second));
    fixture.params.next(convertToParamMap({ year: '2026', state: 'SP' }));
    first.next({ ...empty, meta: { ...empty.meta, total: 99 } });
    second.next({ ...empty, meta: { ...empty.meta, total: 1 } });

    expect(fixture.page.response().meta.total).toBe(1);
  });
});

describe('parseQuery', () => {
  it('falls back safely for malformed pagination', () => {
    expect(
      parseQuery(convertToParamMap({ page: 'abc', year: 'nope' })),
    ).toMatchObject({
      page: 1,
      year: 2026,
      limit: 20,
    });
  });
});

function setup(request: () => ReturnType<CandidatesApiService['list']>) {
  const params = new BehaviorSubject(convertToParamMap({ year: '2026' }));
  const navigate = vi.fn(async () => true);
  const route = { queryParamMap: params } as unknown as ActivatedRoute;
  const router = { navigate } as unknown as Router;
  const api = { list: vi.fn(request) } as unknown as CandidatesApiService;
  const page = new CandidatesPageComponent(route, router, api);
  return { page, params, navigate };
}
