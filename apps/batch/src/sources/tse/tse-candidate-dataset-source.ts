import { basename } from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

const TSE_CANDIDATE_BASE_URL =
  'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand';

export interface CandidateDatasetDescriptor {
  electionYear: number;
  originalFileName: string;
  sourceUrl: string;
}

export interface CandidateDatasetDownload extends CandidateDatasetDescriptor {
  content: Readable;
  contentType: string;
}

export interface CandidateDatasetSource {
  resolve(electionYear: number): CandidateDatasetDescriptor;
  download(electionYear: number): Promise<CandidateDatasetDownload>;
}

export class TseCandidateDatasetSource implements CandidateDatasetSource {
  constructor(
    private readonly request: typeof fetch = fetch,
    private readonly timeoutMs = 60_000,
  ) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error('TSE download timeout must be a positive integer');
    }
  }

  resolve(electionYear: number): CandidateDatasetDescriptor {
    if (
      !Number.isSafeInteger(electionYear) ||
      electionYear < 1900 ||
      electionYear > 9999
    ) {
      throw new Error('Election year must be an integer between 1900 and 9999');
    }

    const sourceUrl = `${TSE_CANDIDATE_BASE_URL}/consulta_cand_${electionYear}.zip`;
    return {
      electionYear,
      originalFileName: basename(new URL(sourceUrl).pathname),
      sourceUrl,
    };
  }

  async download(electionYear: number): Promise<CandidateDatasetDownload> {
    const descriptor = this.resolve(electionYear);

    try {
      const response = await this.request(descriptor.sourceUrl, {
        redirect: 'follow',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          accept: 'application/zip, application/octet-stream',
          'user-agent': 'Eleja/0.0 (+https://github.com/)',
        },
      });

      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 404) {
          throw new Error(
            `TSE candidate dataset not found for ${electionYear}`,
          );
        }
        throw new Error(
          `TSE candidate dataset download failed with HTTP ${response.status}`,
        );
      }
      if (!response.body) {
        throw new Error(
          'TSE candidate dataset response did not contain a body',
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
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith('TSE candidate')) {
        throw error;
      }
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error(
          `TSE candidate dataset download timed out after ${this.timeoutMs}ms`,
          { cause: error },
        );
      }
      throw new Error('TSE candidate dataset download failed', {
        cause: error,
      });
    }
  }
}
