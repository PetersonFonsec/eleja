export class CamaraApiClient {
  readonly baseUrl: string;

  constructor(
    private readonly request: typeof fetch = fetch,
    private readonly timeoutMs = 20_000,
    baseUrl = 'https://dadosabertos.camara.leg.br/api/v2/',
  ) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error('Câmara request timeout must be a positive integer');
    }
    this.baseUrl = new URL(baseUrl).href;
  }

  resolve(path: string): string {
    return new URL(path, this.baseUrl).href;
  }

  async fetchJson(url: string, resource: string): Promise<unknown> {
    const text = await this.fetchText(url, resource);
    try {
      return JSON.parse(text) as unknown;
    } catch (error: unknown) {
      throw new Error(`Câmara ${resource} response is malformed`, {
        cause: error,
      });
    }
  }

  async fetchText(url: string, resource: string): Promise<string> {
    try {
      const response = await this.request(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          accept: 'application/json',
          'user-agent': 'Eleja/0.0 (+https://github.com/)',
        },
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(
          `Câmara ${resource} request failed with HTTP ${response.status}`,
        );
      }
      return await response.text();
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith('Câmara ')) {
        throw error;
      }
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new Error(
          `Câmara ${resource} request timed out after ${this.timeoutMs}ms`,
          { cause: error },
        );
      }
      throw new Error(`Câmara ${resource} request failed`, { cause: error });
    }
  }
}
