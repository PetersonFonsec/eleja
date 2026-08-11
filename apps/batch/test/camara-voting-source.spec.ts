import { describe, expect, it, vi } from 'vitest';
import { CamaraApiClient } from '../src/sources/camara/camara-api-client.js';
import { CamaraVotingSource } from '../src/sources/camara/camara-voting-source.js';

describe('CamaraVotingSource', () => {
  it('follows pagination, deduplicates events and reads individual votes', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json(
          page(
            [voting('123-1')],
            'https://example.test/api/v2/votacoes?pagina=2',
          ),
        ),
      )
      .mockResolvedValueOnce(json(page([voting('123-1'), voting('123-2')])))
      .mockResolvedValueOnce(
        json({
          dados: [vote(10, 'Sim'), vote(11, 'Não'), vote(null, 'Abstenção')],
        }),
      );
    const source = createSource(request);
    const events = await source.fetchVotings({
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    });
    expect(events.map((item) => item.externalId)).toEqual(['123-1', '123-2']);
    await expect(source.fetchVotes('123-1')).resolves.toEqual([
      expect.objectContaining({
        deputyExternalId: '10',
        sourcePosition: 'Sim',
      }),
      expect.objectContaining({
        deputyExternalId: '11',
        sourcePosition: 'Não',
      }),
      expect.objectContaining({
        deputyExternalId: null,
        sourcePosition: 'Abstenção',
      }),
    ]);
  });

  it('accepts empty history', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(json(page([])));
    await expect(
      createSource(request).fetchVotings({
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      }),
    ).resolves.toEqual([]);
  });

  it('reports non-success, malformed responses and timeouts', async () => {
    await expect(
      createSource(
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(null, { status: 503 })),
      ).fetchVotings({ startDate: '2025-01-01', endDate: '2025-01-31' }),
    ).rejects.toThrow('HTTP 503');
    await expect(
      createSource(
        vi.fn<typeof fetch>().mockResolvedValue(json({ dados: 'bad' })),
      ).fetchVotings({ startDate: '2025-01-01', endDate: '2025-01-31' }),
    ).rejects.toThrow('response is malformed');
    const error = new Error('timeout');
    error.name = 'TimeoutError';
    await expect(
      createSource(
        vi.fn<typeof fetch>().mockRejectedValue(error),
        5,
      ).fetchVotings({ startDate: '2025-01-01', endDate: '2025-01-31' }),
    ).rejects.toThrow('timed out after 5ms');
  });
});

function createSource(request: typeof fetch, timeout = 1000) {
  return new CamaraVotingSource(
    new CamaraApiClient(request, timeout, 'https://example.test/api/v2/'),
  );
}
function json(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200 });
}
function page(dados: unknown[], next?: string) {
  return { dados, links: next ? [{ rel: 'next', href: next }] : [] };
}
function voting(id: string) {
  return {
    id,
    uri: `https://example.test/api/v2/votacoes/${id}`,
    data: '2025-07-01',
    dataHoraRegistro: '2025-07-01T16:14:29',
    descricao: ' Aprovado. ',
    aprovacao: 1,
    uriProposicaoObjeto: 'https://example.test/api/v2/proposicoes/999',
  };
}
function vote(id: number | null, tipoVoto: string) {
  return {
    tipoVoto,
    dataRegistroVoto: '2025-07-01T16:14:19',
    deputado_: { id },
  };
}
