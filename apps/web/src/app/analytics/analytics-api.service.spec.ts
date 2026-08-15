import '@angular/compiler';
import { HttpClient, HttpParams } from '@angular/common/http';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsApiService } from './analytics-api.service';

describe('AnalyticsApiService', () => {
  it('uses the same combined filters for summary and coverage', () => {
    const get = vi.fn(() => of({}));
    const service = new AnalyticsApiService({ get } as unknown as HttpClient);
    const filters = {
      year: 2026,
      office: 'FEDERAL_DEPUTY',
      state: 'SP',
      party: 'PT',
    };

    service.getSummary(filters).subscribe();
    service.getCoverage(filters).subscribe();
    service.getDeclaredWealthRanking(filters, 10).subscribe();
    service.getParliamentaryExpenseRanking(filters, 10).subscribe();
    service.getLegislativeAnalytics(filters).subscribe();
    service.getCandidateWealthHistory('candidate/a').subscribe();

    expect(get.mock.calls.map(([url]) => url)).toEqual([
      '/api/analytics/summary',
      '/api/analytics/coverage',
      '/api/analytics/rankings/declared-wealth',
      '/api/analytics/rankings/parliamentary-expenses',
      '/api/analytics/legislative',
      '/api/analytics/candidates/candidate%2Fa/wealth-history',
    ]);
    expect(
      get.mock.calls.map(([, options]) =>
        options ? (options as { params: HttpParams }).params.toString() : '',
      ),
    ).toEqual([
      'year=2026&office=FEDERAL_DEPUTY&state=SP&party=PT',
      'year=2026&office=FEDERAL_DEPUTY&state=SP&party=PT',
      'year=2026&office=FEDERAL_DEPUTY&state=SP&party=PT&limit=10',
      'year=2026&office=FEDERAL_DEPUTY&state=SP&party=PT&limit=10',
      'year=2026&office=FEDERAL_DEPUTY&state=SP&party=PT',
      '',
    ]);
  });
});
