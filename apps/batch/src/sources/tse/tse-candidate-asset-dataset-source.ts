import { basename } from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

const BASE_URL = 'https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato';

export class TseCandidateAssetDatasetSource {
  constructor(
    private readonly request: typeof fetch = fetch,
    private readonly timeoutMs = 60_000,
  ) {}

  resolve(electionYear: number) {
    if (!Number.isSafeInteger(electionYear) || electionYear < 1900) {
      throw new Error('Election year must be a valid integer');
    }
    const sourceUrl = `${BASE_URL}/bem_candidato_${electionYear}.zip`;
    return {
      electionYear,
      sourceUrl,
      originalFileName: basename(new URL(sourceUrl).pathname),
    };
  }

  async download(electionYear: number) {
    const descriptor = this.resolve(electionYear);
    const response = await this.request(descriptor.sourceUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { accept: 'application/zip, application/octet-stream' },
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error(
        `TSE candidate asset dataset download failed with HTTP ${response.status}`,
      );
    }
    return {
      ...descriptor,
      contentType:
        response.headers.get('content-type') ?? 'application/octet-stream',
      content: Readable.fromWeb(
        response.body as unknown as NodeReadableStream<Uint8Array>,
      ),
    };
  }
}
