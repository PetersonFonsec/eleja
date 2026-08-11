import { CamaraApiClient } from './camara-api-client.js';
import type {
  CamaraProposalAuthorRecord,
  CamaraProposalRecord,
  CamaraProposalReference,
} from './camara-proposal-record.js';

interface ProposalListPage {
  dados: Array<{ id: number; uri: string }>;
  links: Array<{ rel: string; href: string }>;
}

export class CamaraProposalSource {
  private readonly proposalCache = new Map<
    string,
    Promise<CamaraProposalRecord>
  >();
  private readonly authorCache = new Map<
    string,
    Promise<CamaraProposalAuthorRecord[]>
  >();

  constructor(private readonly client = new CamaraApiClient()) {}

  async fetchReferencesByDeputyId(
    deputyExternalId: string,
  ): Promise<CamaraProposalReference[]> {
    assertNumericIdentifier(deputyExternalId, 'deputy');
    const first = new URL('proposicoes', this.client.baseUrl);
    first.searchParams.set('idDeputadoAutor', deputyExternalId);
    first.searchParams.set('itens', '100');
    first.searchParams.set('ordem', 'ASC');
    first.searchParams.set('ordenarPor', 'id');

    const references = new Map<string, CamaraProposalReference>();
    const visited = new Set<string>();
    let nextUrl: string | null = first.href;
    while (nextUrl !== null) {
      if (visited.has(nextUrl)) {
        throw new Error('Câmara proposal pagination contains a cycle');
      }
      visited.add(nextUrl);
      const page = await this.fetchListPage(nextUrl, deputyExternalId);
      for (const item of page.dados) {
        references.set(String(item.id), {
          externalId: String(item.id),
          sourceUrl: item.uri,
        });
      }
      nextUrl = this.resolveNextLink(page, nextUrl);
    }
    return [...references.values()];
  }

  fetchProposal(externalId: string): Promise<CamaraProposalRecord> {
    assertNumericIdentifier(externalId, 'proposal');
    const cached = this.proposalCache.get(externalId);
    if (cached) return cached;
    const promise = this.fetchProposalUncached(externalId);
    this.proposalCache.set(externalId, promise);
    return promise;
  }

  fetchAuthors(externalId: string): Promise<CamaraProposalAuthorRecord[]> {
    assertNumericIdentifier(externalId, 'proposal');
    const cached = this.authorCache.get(externalId);
    if (cached) return cached;
    const promise = this.fetchAuthorsUncached(externalId);
    this.authorCache.set(externalId, promise);
    return promise;
  }

  private async fetchListPage(
    url: string,
    deputyExternalId: string,
  ): Promise<ProposalListPage> {
    const value = await this.client.fetchJson(
      url,
      `deputy ${deputyExternalId} proposal list`,
    );
    if (
      !isObject(value) ||
      !Array.isArray(value.dados) ||
      !Array.isArray(value.links)
    ) {
      throw new Error(
        `Câmara deputy ${deputyExternalId} proposal list response is malformed`,
      );
    }
    const dados = value.dados.map((item) => {
      if (
        !isObject(item) ||
        !Number.isSafeInteger(item.id) ||
        typeof item.uri !== 'string'
      ) {
        throw new Error(
          `Câmara deputy ${deputyExternalId} proposal list response is malformed`,
        );
      }
      return { id: item.id as number, uri: item.uri };
    });
    const links = value.links.map((link) => {
      if (
        !isObject(link) ||
        typeof link.rel !== 'string' ||
        typeof link.href !== 'string'
      ) {
        throw new Error(
          `Câmara deputy ${deputyExternalId} proposal list response is malformed`,
        );
      }
      return { rel: link.rel, href: link.href };
    });
    return { dados, links };
  }

  private resolveNextLink(
    page: ProposalListPage,
    currentUrl: string,
  ): string | null {
    const href = page.links.find((link) => link.rel === 'next')?.href;
    if (!href) return null;
    const next = new URL(href, currentUrl);
    if (next.origin !== new URL(this.client.baseUrl).origin) {
      throw new Error(
        'Câmara proposal pagination returned an unexpected origin',
      );
    }
    return next.href;
  }

  private async fetchProposalUncached(
    externalId: string,
  ): Promise<CamaraProposalRecord> {
    const value = await this.client.fetchJson(
      this.client.resolve(`proposicoes/${externalId}`),
      `proposal ${externalId}`,
    );
    if (!isObject(value) || !isObject(value.dados)) {
      throw new Error(`Câmara proposal ${externalId} response is malformed`);
    }
    const data = value.dados;
    if (
      data.id !== Number(externalId) ||
      typeof data.uri !== 'string' ||
      typeof data.siglaTipo !== 'string' ||
      !data.siglaTipo.trim() ||
      !Number.isSafeInteger(data.numero) ||
      !Number.isSafeInteger(data.ano) ||
      (data.ementa !== null && typeof data.ementa !== 'string') ||
      (data.dataApresentacao !== null &&
        (typeof data.dataApresentacao !== 'string' ||
          !isDateTime(data.dataApresentacao))) ||
      (data.statusProposicao !== null && !isObject(data.statusProposicao))
    ) {
      throw new Error(`Câmara proposal ${externalId} response is malformed`);
    }
    const sourceStatus = isObject(data.statusProposicao)
      ? readNullableString(data.statusProposicao.descricaoSituacao)
      : null;
    return {
      externalId,
      sourceUrl: data.uri,
      type: data.siglaTipo,
      number: data.numero as number,
      year: data.ano as number,
      summary: readNullableString(data.ementa),
      sourceStatus,
      presentedAt:
        typeof data.dataApresentacao === 'string'
          ? data.dataApresentacao.slice(0, 10)
          : null,
    };
  }

  private async fetchAuthorsUncached(
    externalId: string,
  ): Promise<CamaraProposalAuthorRecord[]> {
    const value = await this.client.fetchJson(
      this.client.resolve(`proposicoes/${externalId}/autores`),
      `proposal ${externalId} authors`,
    );
    if (!isObject(value) || !Array.isArray(value.dados)) {
      throw new Error(
        `Câmara proposal ${externalId} authors response is malformed`,
      );
    }
    return value.dados.map((item) => {
      if (
        !isObject(item) ||
        typeof item.uri !== 'string' ||
        typeof item.tipo !== 'string' ||
        (item.ordemAssinatura !== null &&
          (!Number.isSafeInteger(item.ordemAssinatura) ||
            Number(item.ordemAssinatura) <= 0)) ||
        (item.proponente !== 0 && item.proponente !== 1)
      ) {
        throw new Error(
          `Câmara proposal ${externalId} authors response is malformed`,
        );
      }
      return {
        proposalExternalId: externalId,
        deputyExternalId: deputyIdFromUri(item.uri),
        authorType: item.tipo,
        sourceAuthorOrder: item.ordemAssinatura as number | null,
        isPrimaryAuthor: item.proponente === 1,
      };
    });
  }
}

function assertNumericIdentifier(value: string, resource: string): void {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`Câmara ${resource} identifier must be a safe integer`);
  }
}

function deputyIdFromUri(uri: string): string | null {
  const match =
    /^https:\/\/dadosabertos\.camara\.leg\.br\/api\/v2\/deputados\/(\d+)$/.exec(
      uri,
    );
  return match?.[1] ?? null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function isDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value);
}
