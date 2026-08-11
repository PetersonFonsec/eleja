import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import type {
  CandidateAssetsResponse,
  CandidateDetail,
  CandidateListQuery,
  CandidateListResponse,
  CandidateLegislativeProfile,
  ExpenseQuery,
  ExpenseResponse,
  LegislativeMandate,
  ProposalQuery,
  ProposalResponse,
  VoteQuery,
  VoteResponse,
} from './candidate.types';

@Injectable({ providedIn: 'root' })
export class CandidatesApiService {
  constructor(private readonly http: HttpClient) {}

  list(query: CandidateListQuery) {
    let params = new HttpParams()
      .set('page', query.page)
      .set('limit', query.limit);
    for (const key of ['year', 'office', 'state', 'party', 'name'] as const) {
      const value = query[key];
      if (value !== undefined && value !== '') params = params.set(key, value);
    }
    return this.http.get<CandidateListResponse>(
      `${environment.apiBaseUrl}/candidates`,
      { params },
    );
  }

  getById(id: string) {
    return this.http.get<CandidateDetail>(
      `${environment.apiBaseUrl}/candidates/${encodeURIComponent(id)}`,
    );
  }

  getAssets(id: string) {
    return this.http.get<CandidateAssetsResponse>(
      `${environment.apiBaseUrl}/candidates/${encodeURIComponent(id)}/assets`,
    );
  }

  getLegislativeProfile(id: string) {
    return this.http.get<CandidateLegislativeProfile>(
      `${this.candidateUrl(id)}/legislative-profile`,
    );
  }
  getMandates(id: string) {
    return this.http.get<LegislativeMandate[]>(
      `${this.candidateUrl(id)}/mandates`,
    );
  }
  getProposals(id: string, query: ProposalQuery) {
    return this.http.get<ProposalResponse>(
      `${this.candidateUrl(id)}/proposals`,
      { params: queryParams(query) },
    );
  }
  getVotes(id: string, query: VoteQuery) {
    return this.http.get<VoteResponse>(`${this.candidateUrl(id)}/votes`, {
      params: queryParams(query),
    });
  }
  getExpenses(id: string, query: ExpenseQuery) {
    return this.http.get<ExpenseResponse>(`${this.candidateUrl(id)}/expenses`, {
      params: queryParams(query),
    });
  }
  private candidateUrl(id: string): string {
    return `${environment.apiBaseUrl}/candidates/${encodeURIComponent(id)}`;
  }
}

function queryParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== '')
      params = params.set(key, String(value));
  return params;
}
