import { describe, expect, it, vi } from 'vitest';
import { CamaraApiClient } from '../src/sources/camara/camara-api-client.js';
import { CamaraProposalSource } from '../src/sources/camara/camara-proposal-source.js';

describe('CamaraProposalSource', () => {
  it('loads a single page and official proposal details/authors', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(page([reference(123)])))
      .mockResolvedValueOnce(json(detail(123)))
      .mockResolvedValueOnce(json(authors()));
    const source = createSource(request);
    await expect(source.fetchReferencesByDeputyId('220593')).resolves.toEqual([
      { externalId: '123', sourceUrl: officialProposalUrl(123) },
    ]);
    await expect(source.fetchProposal('123')).resolves.toMatchObject({
      externalId: '123',
      type: 'PL',
      number: 42,
      year: 2026,
      summary: 'Ementa oficial',
      sourceStatus: 'Aguardando Parecer',
      presentedAt: '2026-03-10',
    });
    await expect(source.fetchAuthors('123')).resolves.toEqual([
      {
        proposalExternalId: '123',
        deputyExternalId: '220593',
        authorType: 'Deputado(a)',
        sourceAuthorOrder: 1,
        isPrimaryAuthor: true,
      },
    ]);
  });

  it('follows all pages and deduplicates references', async () => {
    const next = 'https://example.test/api/v2/proposicoes?pagina=2&itens=100';
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(page([reference(1)], next)))
      .mockResolvedValueOnce(json(page([reference(1), reference(2)])));
    const result = await createSource(request).fetchReferencesByDeputyId('10');
    expect(result.map((item) => item.externalId)).toEqual(['1', '2']);
  });

  it('accepts an empty proposal list', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(json(page([])));
    await expect(
      createSource(request).fetchReferencesByDeputyId('10'),
    ).resolves.toEqual([]);
  });

  it('rejects non-success and malformed payloads', async () => {
    const failed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(
      createSource(failed).fetchReferencesByDeputyId('10'),
    ).rejects.toThrow(
      'Câmara deputy 10 proposal list request failed with HTTP 503',
    );
    const malformed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ dados: 'bad' }));
    await expect(
      createSource(malformed).fetchReferencesByDeputyId('10'),
    ).rejects.toThrow('Câmara deputy 10 proposal list response is malformed');
  });

  it('reports timeouts', async () => {
    const error = new Error('timeout');
    error.name = 'TimeoutError';
    const request = vi.fn<typeof fetch>().mockRejectedValue(error);
    await expect(
      createSource(request, 25).fetchReferencesByDeputyId('10'),
    ).rejects.toThrow(
      'Câmara deputy 10 proposal list request timed out after 25ms',
    );
  });
});

function createSource(request: typeof fetch, timeout = 1000) {
  return new CamaraProposalSource(
    new CamaraApiClient(request, timeout, 'https://example.test/api/v2/'),
  );
}
function json(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200 });
}
function officialProposalUrl(id: number) {
  return `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${id}`;
}
function reference(id: number) {
  return { id, uri: officialProposalUrl(id) };
}
function page(dados: unknown[], next?: string) {
  return { dados, links: next ? [{ rel: 'next', href: next }] : [] };
}
function detail(id: number) {
  return {
    dados: {
      id,
      uri: officialProposalUrl(id),
      siglaTipo: 'PL',
      numero: 42,
      ano: 2026,
      ementa: 'Ementa oficial',
      dataApresentacao: '2026-03-10T14:20',
      statusProposicao: { descricaoSituacao: 'Aguardando Parecer' },
    },
  };
}
function authors() {
  return {
    dados: [
      {
        uri: 'https://dadosabertos.camara.leg.br/api/v2/deputados/220593',
        tipo: 'Deputado(a)',
        ordemAssinatura: 1,
        proponente: 1,
      },
    ],
  };
}
