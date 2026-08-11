import { describe, expect, it, vi } from 'vitest';
import { CamaraApiClient } from '../src/sources/camara/camara-api-client.js';
import { CamaraParliamentaryExpenseSource } from '../src/sources/camara/camara-parliamentary-expense-source.js';

describe('CamaraParliamentaryExpenseSource', () => {
  it('reads exact monetary lexemes and follows pagination', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json(
          page(
            [expense()],
            'https://example.test/api/v2/deputados/10/despesas?pagina=2',
          ),
        ),
      )
      .mockResolvedValueOnce(
        json(page([{ ...expense(), codDocumento: '2', valorDocumento: 0.1 }])),
      );
    const records = await source(request).fetchExpenses({
      deputyExternalId: '10',
      legislatureNumber: 57,
      year: 2025,
    });
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      documentCode: '1',
      grossValue: '1000.01',
      deductionValue: '0',
      netValue: '999.99',
    });
    expect(records[1]?.grossValue).toBe('0.1');
  });
  it('accepts an empty list', async () => {
    await expect(
      source(
        vi.fn<typeof fetch>().mockResolvedValue(json(page([]))),
      ).fetchExpenses({
        deputyExternalId: '10',
        legislatureNumber: 57,
        year: 2025,
      }),
    ).resolves.toEqual([]);
  });
  it('reports non-2xx, malformed responses and timeout', async () => {
    await expect(
      source(
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(null, { status: 503 })),
      ).fetchExpenses({
        deputyExternalId: '10',
        legislatureNumber: 57,
        year: 2025,
      }),
    ).rejects.toThrow('HTTP 503');
    await expect(
      source(
        vi.fn<typeof fetch>().mockResolvedValue(json({ dados: 'bad' })),
      ).fetchExpenses({
        deputyExternalId: '10',
        legislatureNumber: 57,
        year: 2025,
      }),
    ).rejects.toThrow('malformed');
    const error = new Error('timeout');
    error.name = 'TimeoutError';
    await expect(
      source(vi.fn<typeof fetch>().mockRejectedValue(error), 5).fetchExpenses({
        deputyExternalId: '10',
        legislatureNumber: 57,
        year: 2025,
      }),
    ).rejects.toThrow('timed out after 5ms');
  });
});
function source(request: typeof fetch, timeout = 1000) {
  return new CamaraParliamentaryExpenseSource(
    new CamaraApiClient(request, timeout, 'https://example.test/api/v2/'),
  );
}
function json(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200 });
}
function page(dados: unknown[], next?: string) {
  return { dados, links: next ? [{ rel: 'next', href: next }] : [] };
}
function expense() {
  return {
    ano: 2025,
    mes: 7,
    tipoDespesa: 'PASSAGENS',
    nomeFornecedor: 'Fornecedor',
    cnpjCpfFornecedor: '00.000.000/0001-00',
    codDocumento: '1',
    codLote: 20,
    numRessarcimento: '3',
    parcela: 0,
    numDocumento: 'NF-1',
    tipoDocumento: 'Nota Fiscal',
    dataDocumento: '2025-07-01',
    valorDocumento: 1000.01,
    valorGlosa: 0,
    valorLiquido: 999.99,
    urlDocumento: 'https://www.camara.leg.br/documento.pdf',
  };
}
