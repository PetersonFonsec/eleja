import { LegislativeSource } from '@eleja/database';
import { describe, expect, it } from 'vitest';
import { CamaraProposalNormalizer } from '../src/normalization/camara-proposal-normalizer.js';
import type { CamaraProposalRecord } from '../src/sources/camara/camara-proposal-record.js';

describe('CamaraProposalNormalizer', () => {
  it('normalizes official metadata without fabricating a title or status', () => {
    expect(new CamaraProposalNormalizer().normalize(record())).toEqual({
      status: 'NORMALIZED',
      data: {
        source: LegislativeSource.CAMARA,
        externalId: '123',
        type: 'PL',
        number: 42,
        year: 2026,
        title: null,
        summary: 'Ementa oficial',
        status: null,
        sourceStatus: 'Aguardando Parecer',
        url: 'https://dadosabertos.camara.leg.br/api/v2/proposicoes/123',
        presentedAt: '2026-03-10',
      },
    });
  });

  it('rejects malformed identifiers, number and year', () => {
    const normalizer = new CamaraProposalNormalizer();
    expect(normalizer.normalize(record({ externalId: 'abc' })).status).toBe(
      'REJECTED',
    );
    expect(normalizer.normalize(record({ number: 0 })).status).toBe('REJECTED');
    expect(normalizer.normalize(record({ year: 20 })).status).toBe('REJECTED');
  });
});

function record(
  overrides: Partial<CamaraProposalRecord> = {},
): CamaraProposalRecord {
  return {
    externalId: '123',
    sourceUrl: 'https://dadosabertos.camara.leg.br/api/v2/proposicoes/123',
    type: 'pl',
    number: 42,
    year: 2026,
    summary: ' Ementa oficial ',
    sourceStatus: ' Aguardando Parecer ',
    presentedAt: '2026-03-10',
    ...overrides,
  };
}
