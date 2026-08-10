import type { CamaraDeputyRecord } from './camara-deputy-record.js';
import { CamaraApiClient } from './camara-api-client.js';

const DEFAULT_BASE_URL = 'https://dadosabertos.camara.leg.br/api/v2/';

interface ListItem {
  id: number;
  uri: string;
}

interface ListPage {
  dados: ListItem[];
  links: Array<{ rel: string; href: string }>;
}

export interface CamaraDeputySourceOptions {
  startDate: string;
  endDate: string;
}

export class CamaraDeputySource {
  private readonly client: CamaraApiClient;

  constructor(
    request: typeof fetch = fetch,
    timeoutMs = 20_000,
    private readonly baseUrl = DEFAULT_BASE_URL,
  ) {
    this.client = new CamaraApiClient(request, timeoutMs, baseUrl);
  }

  async fetchAll(
    options: CamaraDeputySourceOptions,
  ): Promise<CamaraDeputyRecord[]> {
    validateDate(options.startDate, 'start');
    validateDate(options.endDate, 'end');
    if (options.endDate < options.startDate) {
      throw new Error('Câmara deputy interval end cannot precede start');
    }

    const firstUrl = new URL('deputados', this.baseUrl);
    firstUrl.searchParams.set('dataInicio', options.startDate);
    firstUrl.searchParams.set('dataFim', options.endDate);
    firstUrl.searchParams.set('itens', '100');
    firstUrl.searchParams.set('ordem', 'ASC');
    firstUrl.searchParams.set('ordenarPor', 'id');

    const deputiesById = new Map<number, ListItem>();
    let nextUrl: string | null = firstUrl.href;
    const visited = new Set<string>();
    while (nextUrl !== null) {
      if (visited.has(nextUrl)) {
        throw new Error('Câmara deputy pagination contains a cycle');
      }
      visited.add(nextUrl);
      const page = await this.fetchListPage(nextUrl);
      for (const deputy of page.dados) deputiesById.set(deputy.id, deputy);
      nextUrl = this.resolveNextLink(page, nextUrl);
    }

    return this.fetchDetails([...deputiesById.values()]);
  }

  private async fetchListPage(url: string): Promise<ListPage> {
    const value = await this.client.fetchJson(url, 'deputy list');
    if (
      !isObject(value) ||
      !Array.isArray(value.dados) ||
      !Array.isArray(value.links)
    ) {
      throw new Error('Câmara deputy list response is malformed');
    }
    const dados = value.dados.map((item) => {
      if (
        !isObject(item) ||
        !Number.isSafeInteger(item.id) ||
        typeof item.uri !== 'string'
      ) {
        throw new Error('Câmara deputy list response is malformed');
      }
      return { id: item.id as number, uri: item.uri };
    });
    const links = value.links.map((link) => {
      if (
        !isObject(link) ||
        typeof link.rel !== 'string' ||
        typeof link.href !== 'string'
      ) {
        throw new Error('Câmara deputy list response is malformed');
      }
      return { rel: link.rel, href: link.href };
    });
    return { dados, links };
  }

  private resolveNextLink(page: ListPage, currentUrl: string): string | null {
    const href = page.links.find((link) => link.rel === 'next')?.href;
    if (!href) return null;
    const next = new URL(href, currentUrl);
    if (next.origin !== new URL(this.baseUrl).origin) {
      throw new Error('Câmara deputy pagination returned an unexpected origin');
    }
    return next.href;
  }

  private async fetchDetails(items: ListItem[]): Promise<CamaraDeputyRecord[]> {
    const records: CamaraDeputyRecord[] = [];
    const concurrency = 8;
    for (let index = 0; index < items.length; index += concurrency) {
      const chunk = items.slice(index, index + concurrency);
      records.push(
        ...(await Promise.all(chunk.map((item) => this.fetchDetail(item)))),
      );
    }
    return records;
  }

  private async fetchDetail(item: ListItem): Promise<CamaraDeputyRecord> {
    const detailUrl = new URL(`deputados/${item.id}`, this.baseUrl).href;
    const value = await this.client.fetchJson(detailUrl, `deputy ${item.id}`);
    if (!isObject(value) || !isObject(value.dados)) {
      throw new Error(`Câmara deputy ${item.id} response is malformed`);
    }
    const detail = value.dados;
    if (
      detail.id !== item.id ||
      typeof detail.nomeCivil !== 'string' ||
      !detail.nomeCivil.trim() ||
      (detail.dataNascimento !== null &&
        (typeof detail.dataNascimento !== 'string' ||
          !isDateOnly(detail.dataNascimento)))
    ) {
      throw new Error(`Câmara deputy ${item.id} response is malformed`);
    }
    const status = isObject(detail.ultimoStatus) ? detail.ultimoStatus : null;
    return {
      externalId: String(item.id),
      name: detail.nomeCivil,
      parliamentaryName: readNullableString(
        status?.nomeEleitoral ?? status?.nome,
      ),
      state: readNullableString(status?.siglaUf),
      partyAcronym: readNullableString(status?.siglaPartido),
      birthDate: detail.dataNascimento as string | null,
      photoUrl: readNullableString(status?.urlFoto),
      profileUrl: item.uri,
    };
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function isDateOnly(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function validateDate(value: string, label: string): void {
  if (!isDateOnly(value))
    throw new Error(`Câmara deputy interval ${label} must be YYYY-MM-DD`);
}
