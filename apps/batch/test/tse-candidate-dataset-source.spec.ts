import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import { TseCandidateDatasetSource } from '../src/sources/tse/tse-candidate-dataset-source.js';

async function readContent(
  response: Awaited<ReturnType<TseCandidateDatasetSource['download']>>,
) {
  const chunks: Buffer[] = [];
  for await (const chunk of response.content) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

describe('TseCandidateDatasetSource', () => {
  it('resolves the official TSE candidate archive for a year', () => {
    const source = new TseCandidateDatasetSource();

    expect(source.resolve(2026)).toEqual({
      electionYear: 2026,
      originalFileName: 'consulta_cand_2026.zip',
      sourceUrl:
        'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip',
    });
  });

  it('streams the response bytes and preserves response metadata', async () => {
    const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]);
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: { 'content-type': 'application/zip' },
      }),
    );
    const source = new TseCandidateDatasetSource(request);

    const result = await source.download(2026);

    expect(result.contentType).toBe('application/zip');
    expect(await readContent(result)).toEqual(Buffer.from(bytes));
    expect(request).toHaveBeenCalledWith(
      result.sourceUrl,
      expect.objectContaining({ redirect: 'follow' }),
    );
  });

  it('reports a missing yearly dataset', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 404 }));

    await expect(
      new TseCandidateDatasetSource(request).download(2030),
    ).rejects.toThrow('TSE candidate dataset not found for 2030');
  });

  it('reports unexpected HTTP responses without including their body', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('upstream details', { status: 503 }));

    await expect(
      new TseCandidateDatasetSource(request).download(2026),
    ).rejects.toThrow('TSE candidate dataset download failed with HTTP 503');
  });

  it('wraps network failures with source context', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('connection reset'));

    await expect(
      new TseCandidateDatasetSource(request).download(2026),
    ).rejects.toThrow('TSE candidate dataset download failed');
  });

  it('enforces the configured request timeout', async () => {
    const request = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          );
        }),
    );

    await expect(
      new TseCandidateDatasetSource(request, 5).download(2026),
    ).rejects.toThrow('timed out after 5ms');
  });
});
