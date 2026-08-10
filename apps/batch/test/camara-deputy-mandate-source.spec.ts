import { describe, expect, it, vi } from 'vitest';
import { CamaraApiClient } from '../src/sources/camara/camara-api-client.js';
import { CamaraDeputyMandateSource } from '../src/sources/camara/camara-deputy-mandate-source.js';

describe('CamaraDeputyMandateSource', () => {
  it('loads valid history and legislature periods', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(history([event(57, '2023-02-01T12:05', 'Exercício')])),
      )
      .mockResolvedValueOnce(
        jsonResponse(legislature(57, '2023-02-01', '2027-01-31')),
      );
    const records = await source(request).fetchByDeputyId('220593');
    expect(records).toEqual([
      expect.objectContaining({
        deputyExternalId: '220593',
        legislatureNumber: 57,
        state: 'MT',
        partyAcronym: 'PL',
        occurredAt: '2023-02-01T12:05',
        situation: 'Exercício',
        legislatureStartedAt: '2023-02-01',
        legislatureEndedAt: '2027-01-31',
      }),
    ]);
  });

  it('loads each legislature once for a multiple-legislature history', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          history([
            event(56, '2019-02-01T10:00', 'Exercício'),
            event(56, '2023-01-31T23:59', 'Fim de Mandato'),
            event(57, '2023-02-01T10:00', 'Exercício'),
          ]),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(legislature(56, '2019-02-01', '2023-01-31')),
      )
      .mockResolvedValueOnce(
        jsonResponse(legislature(57, '2023-02-01', '2027-01-31')),
      );
    const records = await source(request).fetchByDeputyId('220593');
    expect(records).toHaveLength(3);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('accepts empty mandate history without legislature calls', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(history([])));
    await expect(source(request).fetchByDeputyId('220593')).resolves.toEqual(
      [],
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('rejects non-success and malformed history responses', async () => {
    const failed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(source(failed).fetchByDeputyId('220593')).rejects.toThrow(
      'Câmara deputy 220593 mandate history request failed with HTTP 503',
    );

    const malformed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ dados: [{}] }));
    await expect(source(malformed).fetchByDeputyId('220593')).rejects.toThrow(
      'Câmara deputy 220593 mandate history response is malformed',
    );
  });

  it('reports timeouts', async () => {
    const error = new Error('timeout');
    error.name = 'TimeoutError';
    const request = vi.fn<typeof fetch>().mockRejectedValue(error);
    await expect(source(request, 25).fetchByDeputyId('220593')).rejects.toThrow(
      'Câmara deputy 220593 mandate history request timed out after 25ms',
    );
  });
});

function source(request: typeof fetch, timeoutMs = 1000) {
  return new CamaraDeputyMandateSource(
    new CamaraApiClient(request, timeoutMs, 'https://example.test/api/v2/'),
  );
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200 });
}

function history(events: unknown[]) {
  return { dados: events };
}

function event(idLegislatura: number, dataHora: string, situacao: string) {
  return {
    id: 220593,
    idLegislatura,
    siglaUf: 'MT',
    siglaPartido: 'PL',
    dataHora,
    situacao,
    descricaoStatus: `Situação ${situacao}`,
  };
}

function legislature(id: number, dataInicio: string, dataFim: string) {
  return { dados: { id, dataInicio, dataFim } };
}
