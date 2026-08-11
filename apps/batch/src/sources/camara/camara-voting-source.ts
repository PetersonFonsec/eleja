import { CamaraApiClient } from './camara-api-client.js';
import type {
  CamaraDeputyVoteRecord,
  CamaraVotingPeriod,
  CamaraVotingRecord,
} from './camara-voting-record.js';

interface ListPage {
  dados: unknown[];
  links: Array<{ rel: string; href: string }>;
}

export class CamaraVotingSource {
  private readonly votesCache = new Map<
    string,
    Promise<CamaraDeputyVoteRecord[]>
  >();

  constructor(private readonly client = new CamaraApiClient()) {}

  async fetchVotings(
    period: CamaraVotingPeriod,
  ): Promise<CamaraVotingRecord[]> {
    assertDate(period.startDate);
    assertDate(period.endDate);
    if (
      period.startDate > period.endDate ||
      period.startDate.slice(0, 4) !== period.endDate.slice(0, 4)
    ) {
      throw new Error(
        'Câmara voting period must be ordered and contained in one year',
      );
    }
    const first = new URL('votacoes', this.client.baseUrl);
    first.searchParams.set('dataInicio', period.startDate);
    first.searchParams.set('dataFim', period.endDate);
    first.searchParams.set('itens', '100');
    first.searchParams.set('ordem', 'ASC');
    first.searchParams.set('ordenarPor', 'dataHoraRegistro');
    const records = new Map<string, CamaraVotingRecord>();
    const visited = new Set<string>();
    let next: string | null = first.href;
    while (next) {
      if (visited.has(next))
        throw new Error('Câmara voting pagination contains a cycle');
      visited.add(next);
      const page = await this.fetchPage(next);
      for (const raw of page.dados) {
        const record = parseVoting(raw);
        records.set(record.externalId, record);
      }
      const href = page.links.find((link) => link.rel === 'next')?.href;
      next = href ? safeNextUrl(href, next, this.client.baseUrl) : null;
    }
    return [...records.values()];
  }

  fetchVotes(votingExternalId: string): Promise<CamaraDeputyVoteRecord[]> {
    if (!/^[A-Za-z0-9.-]+$/.test(votingExternalId))
      throw new Error('Câmara voting identifier is invalid');
    const cached = this.votesCache.get(votingExternalId);
    if (cached) return cached;
    const promise = this.fetchVotesUncached(votingExternalId);
    this.votesCache.set(votingExternalId, promise);
    return promise;
  }

  private async fetchPage(url: string): Promise<ListPage> {
    const value = await this.client.fetchJson(url, 'voting list');
    if (
      !isObject(value) ||
      !Array.isArray(value.dados) ||
      !Array.isArray(value.links)
    )
      throw new Error('Câmara voting list response is malformed');
    const links = value.links.map((link) => {
      if (
        !isObject(link) ||
        typeof link.rel !== 'string' ||
        typeof link.href !== 'string'
      )
        throw new Error('Câmara voting list response is malformed');
      return { rel: link.rel, href: link.href };
    });
    return { dados: value.dados, links };
  }

  private async fetchVotesUncached(
    votingExternalId: string,
  ): Promise<CamaraDeputyVoteRecord[]> {
    const value = await this.client.fetchJson(
      this.client.resolve(`votacoes/${votingExternalId}/votos`),
      `voting ${votingExternalId} votes`,
    );
    if (!isObject(value) || !Array.isArray(value.dados))
      throw new Error(
        `Câmara voting ${votingExternalId} votes response is malformed`,
      );
    return value.dados.map((raw) => parseVote(votingExternalId, raw));
  }
}

function parseVoting(raw: unknown): CamaraVotingRecord {
  if (
    !isObject(raw) ||
    typeof raw.id !== 'string' ||
    !raw.id.trim() ||
    typeof raw.uri !== 'string' ||
    typeof raw.data !== 'string' ||
    typeof raw.dataHoraRegistro !== 'string' ||
    (raw.descricao !== null && typeof raw.descricao !== 'string') ||
    (raw.aprovacao !== null && raw.aprovacao !== 0 && raw.aprovacao !== 1) ||
    (raw.uriProposicaoObjeto !== null &&
      typeof raw.uriProposicaoObjeto !== 'string')
  ) {
    throw new Error('Câmara voting list response is malformed');
  }
  return {
    externalId: raw.id,
    sourceUrl: raw.uri,
    date: raw.data,
    registeredAt: raw.dataHoraRegistro,
    description: raw.descricao,
    approval: raw.aprovacao as 0 | 1 | null,
    proposalExternalId: raw.uriProposicaoObjeto
      ? numericIdFromUri(raw.uriProposicaoObjeto)
      : null,
  };
}

function parseVote(
  votingExternalId: string,
  raw: unknown,
): CamaraDeputyVoteRecord {
  if (
    !isObject(raw) ||
    typeof raw.tipoVoto !== 'string' ||
    !raw.tipoVoto.trim() ||
    (raw.dataRegistroVoto !== null &&
      typeof raw.dataRegistroVoto !== 'string') ||
    !isObject(raw.deputado_)
  ) {
    throw new Error(
      `Câmara voting ${votingExternalId} votes response is malformed`,
    );
  }
  const deputyId = raw.deputado_.id;
  return {
    votingExternalId,
    deputyExternalId: Number.isSafeInteger(deputyId) ? String(deputyId) : null,
    sourcePosition: raw.tipoVoto,
    registeredAt: raw.dataRegistroVoto as string | null,
  };
}

function numericIdFromUri(uri: string): string | null {
  const match = /\/proposicoes\/(\d+)\/?$/.exec(uri);
  return match?.[1] ?? null;
}

function safeNextUrl(href: string, current: string, base: string): string {
  const next = new URL(href, current);
  if (next.origin !== new URL(base).origin)
    throw new Error('Câmara voting pagination returned an unexpected origin');
  return next.href;
}

function assertDate(value: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  )
    throw new Error('Câmara voting period date is invalid');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
