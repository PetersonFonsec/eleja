import '@angular/compiler';
import { HttpClient, HttpParams } from '@angular/common/http';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CandidatesApiService } from './candidates-api.service';

describe('CandidatesApiService', () => {
  it('sends pagination and combined filters to the candidates endpoint', () => {
    const get = vi.fn(() => of({ data: [], meta: {} }));
    const service = new CandidatesApiService({ get } as unknown as HttpClient);

    service
      .list({
        page: 2,
        limit: 20,
        year: 2026,
        office: 'FEDERAL_DEPUTY',
        state: 'SP',
        party: 'PT',
        name: 'Maria',
      })
      .subscribe();

    expect(get).toHaveBeenCalledOnce();
    const [url, options] = get.mock.calls[0]!;
    expect(url).toBe('/api/candidates');
    expect((options as { params: HttpParams }).params.toString()).toBe(
      'page=2&limit=20&year=2026&office=FEDERAL_DEPUTY&state=SP&party=PT&name=Maria',
    );
  });

  it('constructs candidate detail and asset URLs', () => {
    const get = vi.fn(() => of({}));
    const service = new CandidatesApiService({ get } as unknown as HttpClient);

    service.getById('candidate-id').subscribe();
    service.getAssets('candidate-id').subscribe();

    expect(get.mock.calls.map(([url]) => url)).toEqual([
      '/api/candidates/candidate-id',
      '/api/candidates/candidate-id/assets',
    ]);
  });
});
