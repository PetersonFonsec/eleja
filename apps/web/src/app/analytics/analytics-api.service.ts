import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import type {
  AnalyticsCoverage,
  AnalyticsFilters,
  AnalyticsSummary,
  DeclaredWealthRanking,
  LegislativeAnalytics,
  ParliamentaryExpenseRanking,
  CandidateWealthHistory,
} from './analytics.types';

@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  constructor(private readonly http: HttpClient) {}

  getSummary(filters: AnalyticsFilters) {
    return this.http.get<AnalyticsSummary>(
      `${environment.apiBaseUrl}/analytics/summary`,
      { params: analyticsParams(filters) },
    );
  }

  getCoverage(filters: AnalyticsFilters) {
    return this.http.get<AnalyticsCoverage>(
      `${environment.apiBaseUrl}/analytics/coverage`,
      { params: analyticsParams(filters) },
    );
  }

  getDeclaredWealthRanking(filters: AnalyticsFilters, limit = 10) {
    return this.http.get<DeclaredWealthRanking>(
      `${environment.apiBaseUrl}/analytics/rankings/declared-wealth`,
      { params: analyticsParams(filters).set('limit', limit) },
    );
  }

  getParliamentaryExpenseRanking(filters: AnalyticsFilters, limit = 10) {
    return this.http.get<ParliamentaryExpenseRanking>(
      `${environment.apiBaseUrl}/analytics/rankings/parliamentary-expenses`,
      { params: analyticsParams(filters).set('limit', limit) },
    );
  }

  getCandidateWealthHistory(candidateId: string) {
    return this.http.get<CandidateWealthHistory>(
      `${environment.apiBaseUrl}/analytics/candidates/${encodeURIComponent(candidateId)}/wealth-history`,
    );
  }

  getLegislativeAnalytics(filters: AnalyticsFilters) {
    return this.http.get<LegislativeAnalytics>(
      `${environment.apiBaseUrl}/analytics/legislative`,
      { params: analyticsParams(filters) },
    );
  }
}

export function analyticsParams(filters: AnalyticsFilters): HttpParams {
  let params = new HttpParams().set('year', filters.year);
  for (const key of ['office', 'state', 'party'] as const) {
    const value = filters[key];
    if (value) params = params.set(key, value);
  }
  return params;
}
