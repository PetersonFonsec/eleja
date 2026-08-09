import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import type {
  CandidateListQuery,
  CandidateListResponse,
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
}
