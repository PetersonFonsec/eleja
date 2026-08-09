import '@angular/compiler';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import type {
  CandidateAssetsResponse,
  CandidateDetail,
} from './candidate.types';
import { CandidatesApiService } from './candidates-api.service';
import { CandidateDetailPageComponent } from './candidate-detail-page.component';
import { formatBrlDecimal, formatDateOnly } from './candidate-formatters';

const ID = '93280ad8-b089-46cc-9848-91462ff63e7c';
const SECOND_ID = '1f5fba20-97fd-43e2-93b8-2abe19278720';
const candidate: CandidateDetail = {
  id: ID,
  person: {
    name: 'Maria de Souza Silva',
    birthDate: '1985-04-17',
    gender: 'Feminino',
    education: 'Superior completo',
    occupation: 'Professora',
  },
  candidacy: {
    ballotName: 'Maria Silva',
    ballotNumber: 13,
    photoUrl: null,
    status: 'ACTIVE',
    sourceStatus: 'Apto',
    state: 'SP',
    city: null,
  },
  party: { id: 'party', name: 'Partido Exemplo', acronym: 'PEX', number: 13 },
  office: {
    id: 'office',
    code: 'GOVERNOR',
    name: 'Governador',
    scope: 'STATE',
  },
  election: { id: 'election', year: 2026, type: 'GENERAL', round: 1 },
};
const assets: CandidateAssetsResponse = {
  candidateId: ID,
  summary: { totalAssets: 1, totalDeclaredValue: '1250000.50' },
  data: [
    {
      id: 'asset',
      typeCode: '1',
      type: 'Apartamento',
      description: 'Apartamento localizado em São Paulo',
      value: '1250000.50',
    },
  ],
};

describe('CandidateDetailPageComponent', () => {
  it('loads candidate and assets independently and exposes important values', () => {
    const candidateRequest = new Subject<CandidateDetail>();
    const assetRequest = new Subject<CandidateAssetsResponse>();
    const page = setup(
      () => candidateRequest,
      () => assetRequest,
    ).page;
    expect(page.candidateState().status).toBe('loading');
    expect(page.assetsState().status).toBe('loading');

    candidateRequest.next(candidate);
    expect(page.candidateState()).toEqual({ status: 'ready', data: candidate });
    expect(page.assetsState().status).toBe('loading');

    assetRequest.next(assets);
    expect(page.assetsState()).toEqual({ status: 'ready', data: assets });
    expect(candidate.candidacy.ballotName).toBe('Maria Silva');
    expect(candidate.person.name).toBe('Maria de Souza Silva');
    expect(candidate.party.acronym).toBe('PEX');
    expect(candidate.office.name).toBe('Governador');
    expect(assets.summary.totalAssets).toBe(1);
    expect(formatBrlDecimal(assets.summary.totalDeclaredValue)).toBe(
      'R$ 1.250.000,50',
    );
  });

  it('represents a valid candidate with zero declared assets', () => {
    const zeroAssets = {
      candidateId: ID,
      summary: { totalAssets: 0, totalDeclaredValue: '0.00' },
      data: [],
    };
    const page = setup(
      () => of(candidate),
      () => of(zeroAssets),
    ).page;
    expect(page.assetsState()).toEqual({ status: 'ready', data: zeroAssets });
  });

  it('distinguishes not found from a page-level server error', () => {
    const notFound = setup(
      () => throwError(() => ({ status: 404 })),
      () => of(assets),
    ).page;
    expect(notFound.candidateState().status).toBe('not-found');

    const failed = setup(
      () => throwError(() => ({ status: 500 })),
      () => of(assets),
    ).page;
    expect(failed.candidateState().status).toBe('error');
  });

  it('keeps candidate details when only assets fail', () => {
    const page = setup(
      () => of(candidate),
      () => throwError(() => new Error('asset failure')),
    ).page;
    expect(page.candidateState()).toEqual({ status: 'ready', data: candidate });
    expect(page.assetsState().status).toBe('error');
  });

  it('handles malformed UUIDs without calling the API', () => {
    const fixture = setup(
      () => of(candidate),
      () => of(assets),
      'invalid',
    );
    expect(fixture.page.candidateState().status).toBe('invalid');
    expect(fixture.getByIdCalls()).toBe(0);
    expect(fixture.getAssetsCalls()).toBe(0);
  });

  it('cancels stale responses when the route id changes', () => {
    const first = new Subject<CandidateDetail>();
    const second = new Subject<CandidateDetail>();
    let calls = 0;
    const fixture = setup(
      () => (++calls === 1 ? first : second),
      () => of(assets),
    );
    fixture.params.next(convertToParamMap({ id: SECOND_ID }));
    first.next(candidate);
    const newer = { ...candidate, id: SECOND_ID };
    second.next(newer);
    expect(fixture.page.candidateState()).toEqual({
      status: 'ready',
      data: newer,
    });
  });
});

describe('candidate detail formatters', () => {
  it.each([
    ['0.00', 'R$ 0,00'],
    ['0.10', 'R$ 0,10'],
    ['1250000.50', 'R$ 1.250.000,50'],
    ['999999999.99', 'R$ 999.999.999,99'],
  ])('formats exact decimal %s', (value, expected) => {
    expect(formatBrlDecimal(value)).toBe(expected);
  });

  it('formats a date-only value without timezone conversion', () => {
    expect(formatDateOnly('1985-04-17')).toBe('17/04/1985');
  });
});

function setup(
  detail: () => ReturnType<CandidatesApiService['getById']>,
  assetList: () => ReturnType<CandidatesApiService['getAssets']>,
  initialId = ID,
) {
  const params = new BehaviorSubject(convertToParamMap({ id: initialId }));
  let getByIdCalls = 0;
  let getAssetsCalls = 0;
  const api = {
    getById: () => {
      getByIdCalls += 1;
      return detail();
    },
    getAssets: () => {
      getAssetsCalls += 1;
      return assetList();
    },
  } as CandidatesApiService;
  const page = new CandidateDetailPageComponent(
    { paramMap: params } as unknown as ActivatedRoute,
    api,
  );
  return {
    page,
    params,
    getByIdCalls: () => getByIdCalls,
    getAssetsCalls: () => getAssetsCalls,
  };
}
