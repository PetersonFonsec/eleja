import { describe, expect, it, vi } from 'vitest';
import { CamaraDeputySource } from '../src/sources/camara/camara-deputy-source.js';

const interval = { startDate: '2023-02-01', endDate: '2026-08-10' };

describe('CamaraDeputySource', () => {
  it('loads one page and detailed identity fields', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(page([listItem(1)])))
      .mockResolvedValueOnce(
        jsonResponse(detail(1, 'JOÃO DA SILVA', '1980-01-15')),
      );

    const records = await new CamaraDeputySource(
      request,
      1000,
      'https://example.test/api/v2/',
    ).fetchAll(interval);

    expect(records).toEqual([
      expect.objectContaining({
        externalId: '1',
        name: 'JOÃO DA SILVA',
        birthDate: '1980-01-15',
        parliamentaryName: 'João',
        state: 'SP',
        partyAcronym: 'ABC',
      }),
    ]);
  });

  it('follows next links and deduplicates deputy IDs before details', async () => {
    const next = 'https://example.test/api/v2/deputados?pagina=2&itens=100';
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(page([listItem(1)], next)))
      .mockResolvedValueOnce(jsonResponse(page([listItem(1), listItem(2)])))
      .mockResolvedValueOnce(jsonResponse(detail(1, 'Pessoa Um', '1980-01-01')))
      .mockResolvedValueOnce(
        jsonResponse(detail(2, 'Pessoa Dois', '1981-01-01')),
      );

    const records = await new CamaraDeputySource(
      request,
      1000,
      'https://example.test/api/v2/',
    ).fetchAll(interval);

    expect(records.map((record) => record.externalId)).toEqual(['1', '2']);
    expect(request).toHaveBeenCalledTimes(4);
  });

  it('rejects non-success responses', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(
      new CamaraDeputySource(
        request,
        1000,
        'https://example.test/api/v2/',
      ).fetchAll(interval),
    ).rejects.toThrow('Câmara deputy list request failed with HTTP 503');
  });

  it('rejects malformed responses', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ dados: 'invalid' }));
    await expect(
      new CamaraDeputySource(
        request,
        1000,
        'https://example.test/api/v2/',
      ).fetchAll(interval),
    ).rejects.toThrow('Câmara deputy list response is malformed');
  });

  it('reports request timeouts', async () => {
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    const request = vi.fn<typeof fetch>().mockRejectedValue(timeout);
    await expect(
      new CamaraDeputySource(
        request,
        25,
        'https://example.test/api/v2/',
      ).fetchAll(interval),
    ).rejects.toThrow('Câmara deputy list request timed out after 25ms');
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function listItem(id: number) {
  return { id, uri: `https://example.test/api/v2/deputados/${id}` };
}

function page(items: unknown[], next?: string) {
  return {
    dados: items,
    links: next
      ? [{ rel: 'next', href: next }]
      : [{ rel: 'self', href: 'https://example.test/' }],
  };
}

function detail(id: number, name: string, birthDate: string) {
  return {
    dados: {
      id,
      nomeCivil: name,
      dataNascimento: birthDate,
      ultimoStatus: {
        nome: 'João',
        nomeEleitoral: 'João',
        siglaUf: 'SP',
        siglaPartido: 'ABC',
        urlFoto: `https://example.test/${id}.jpg`,
      },
    },
  };
}
