import '@angular/compiler';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type {
  CandidateAssetsResponse,
  CandidateDetail,
} from './candidate.types';
import { CandidatesApiService } from './candidates-api.service';
import {
  CandidateComparePageComponent,
  parseCandidateComparison,
} from './candidate-compare-page.component';

const A = '93280ad8-b089-46cc-9848-91462ff63e7c';
const B = '1f5fba20-97fd-43e2-93b8-2abe19278720';
const C = '00108c35-de37-4a53-a360-238ba341c6ed';

describe('CandidateComparePageComponent', () => {
  it('loads each unique URL candidate exactly once and combines key fields', () => {
    const fixture = setup(`${A},${A},${B}`);
    expect(fixture.detailCalls).toEqual([A, B]);
    expect(fixture.assetCalls).toEqual([A, B]);
    const state = fixture.page.state();
    expect(state.status).toBe('ready');
    if (state.status !== 'ready') return;
    expect(state.items.map((item) => item.detail.party.acronym)).toEqual([
      'PA',
      'PB',
    ]);
    expect(state.items.map((item) => item.detail.office.name)).toEqual([
      'Governador',
      'Governador',
    ]);
    expect(state.items[0]?.detail.candidacy.state).toBe('SP');
    expect(state.items[0]?.detail.person.education).toBe('Superior completo');
    expect(state.items[0]?.detail.person.occupation).toBe('Professora');
    expect(state.items[0]?.assets).toEqual({
      totalAssets: 2,
      totalDeclaredValue: '1250000.50',
    });
  });

  it('keeps successful candidates when another candidate returns 404', () => {
    const fixture = setup(`${A},${B}`, {
      detail: (id) =>
        id === B ? throwError(() => ({ status: 404 })) : of(detail(id)),
    });
    const state = fixture.page.state();
    expect(state.status).toBe('ready');
    if (state.status !== 'ready') return;
    expect(state.items.map(({ id }) => id)).toEqual([A]);
    expect(fixture.page.missingIds()).toEqual([B]);
  });

  it('keeps candidate data when only the asset summary fails', () => {
    const fixture = setup(`${A},${B}`, {
      assets: (id) =>
        id === B ? throwError(() => new Error('assets')) : of(assets(id)),
    });
    const state = fixture.page.state();
    expect(state.status).toBe('ready');
    if (state.status !== 'ready') return;
    expect(state.items[1]).toMatchObject({
      id: B,
      assets: null,
      assetsFailed: true,
    });
  });

  it('updates the URL when removing and clearing candidates', () => {
    const fixture = setup(`${A},${B},${C}`);
    fixture.page.removeCandidate(B);
    expect(fixture.navigate).toHaveBeenCalledWith(['/compare'], {
      queryParams: { candidates: `${A},${C}` },
    });
    fixture.page.clearComparison();
    expect(fixture.navigate).toHaveBeenLastCalledWith(['/compare'], {
      queryParams: { candidates: null },
    });
  });

  it('shows setup state with fewer than two valid IDs and ignores malformed IDs', () => {
    const fixture = setup(`${A},not-a-uuid`);
    expect(fixture.page.state().status).toBe('setup');
    expect(fixture.page.invalidCount()).toBe(1);
    expect(fixture.detailCalls).toEqual([]);
  });

  it('detects comparisons across offices and election years without blocking them', () => {
    const fixture = setup(`${A},${B}`, {
      detail: (id) =>
        of(
          detail(id, {
            officeId: id === B ? 'other-office' : 'office',
            year: id === B ? 2024 : 2026,
          }),
        ),
    });
    const state = fixture.page.state();
    if (state.status !== 'ready') throw new Error('expected ready state');
    expect(fixture.page.hasDifferentOffice(state.items)).toBe(true);
    expect(fixture.page.hasDifferentElectionYear(state.items)).toBe(true);
  });
});

describe('parseCandidateComparison', () => {
  it('deduplicates, rejects malformed values and enforces the maximum of three', () => {
    expect(
      parseCandidateComparison(
        `${A},invalid,${A},${B},${C},${crypto.randomUUID()}`,
      ),
    ).toEqual({
      ids: [A, B, C],
      invalidCount: 1,
    });
  });
});

function detail(
  id: string,
  options: { officeId?: string; year?: number } = {},
): CandidateDetail {
  const suffix = id === A ? 'A' : 'B';
  return {
    id,
    person: {
      name: `Pessoa ${suffix}`,
      birthDate: '1985-04-17',
      gender: 'Feminino',
      education: 'Superior completo',
      occupation: 'Professora',
    },
    candidacy: {
      ballotName: `Candidata ${suffix}`,
      ballotNumber: id === A ? 10 : 20,
      photoUrl: null,
      status: 'ACTIVE',
      sourceStatus: 'Apto',
      state: 'SP',
      city: null,
    },
    party: {
      id: `party-${suffix}`,
      name: `Partido ${suffix}`,
      acronym: `P${suffix}`,
      number: 10,
    },
    office: {
      id: options.officeId ?? 'office',
      code: 'GOVERNOR',
      name: 'Governador',
      scope: 'STATE',
    },
    election: {
      id: 'election',
      year: options.year ?? 2026,
      type: 'GENERAL',
      round: 1,
    },
  };
}

function assets(id: string): CandidateAssetsResponse {
  return {
    candidateId: id,
    summary: { totalAssets: 2, totalDeclaredValue: '1250000.50' },
    data: [],
  };
}

function setup(
  candidates: string,
  requests: {
    detail?: (id: string) => ReturnType<CandidatesApiService['getById']>;
    assets?: (id: string) => ReturnType<CandidatesApiService['getAssets']>;
  } = {},
) {
  const params = new BehaviorSubject(convertToParamMap({ candidates }));
  const detailCalls: string[] = [];
  const assetCalls: string[] = [];
  const api = {
    getById: (id: string) => {
      detailCalls.push(id);
      return requests.detail?.(id) ?? of(detail(id));
    },
    getAssets: (id: string) => {
      assetCalls.push(id);
      return requests.assets?.(id) ?? of(assets(id));
    },
  } as CandidatesApiService;
  const navigate = vi.fn(async () => true);
  const page = new CandidateComparePageComponent(
    { queryParamMap: params } as unknown as ActivatedRoute,
    { navigate } as unknown as Router,
    api,
    { setTitle: () => undefined } as unknown as Title,
  );
  return { page, params, navigate, detailCalls, assetCalls };
}
