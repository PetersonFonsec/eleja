import { CamaraApiClient } from './camara-api-client.js';
import type {
  CamaraParliamentaryExpenseQuery,
  CamaraParliamentaryExpenseRecord,
} from './camara-parliamentary-expense-record.js';

export class CamaraParliamentaryExpenseSource {
  constructor(private readonly client = new CamaraApiClient()) {}
  async fetchExpenses(
    query: CamaraParliamentaryExpenseQuery,
  ): Promise<CamaraParliamentaryExpenseRecord[]> {
    if (!/^\d+$/.test(query.deputyExternalId))
      throw new Error('Câmara deputy identifier must be numeric');
    if (
      !Number.isSafeInteger(query.legislatureNumber) ||
      query.legislatureNumber <= 0
    )
      throw new Error('Câmara legislature number is invalid');
    if (
      !Number.isSafeInteger(query.year) ||
      query.year < 2008 ||
      query.year > 9999
    )
      throw new Error('Câmara expense year is invalid');
    const first = new URL(
      `deputados/${query.deputyExternalId}/despesas`,
      this.client.baseUrl,
    );
    first.searchParams.set('idLegislatura', String(query.legislatureNumber));
    first.searchParams.set('ano', String(query.year));
    first.searchParams.set('itens', '100');
    first.searchParams.set('ordem', 'ASC');
    first.searchParams.set('ordenarPor', 'ano');
    const result: CamaraParliamentaryExpenseRecord[] = [];
    const visited = new Set<string>();
    let next: string | null = first.href;
    while (next) {
      if (visited.has(next))
        throw new Error('Câmara expense pagination contains a cycle');
      visited.add(next);
      const page = await this.fetchPage(next, query.deputyExternalId);
      result.push(
        ...page.dados.map((item) => parseRecord(query.deputyExternalId, item)),
      );
      const href = page.links.find((link) => link.rel === 'next')?.href;
      next = href ? safeNext(href, next, this.client.baseUrl) : null;
    }
    return result;
  }
  private async fetchPage(
    url: string,
    deputyId: string,
  ): Promise<{
    dados: unknown[];
    links: Array<{ rel: string; href: string }>;
  }> {
    const raw = await this.client.fetchText(url, `deputy ${deputyId} expenses`);
    let value: unknown;
    try {
      value = JSON.parse(quoteMoney(raw));
    } catch (error) {
      throw new Error(
        `Câmara deputy ${deputyId} expenses response is malformed`,
        { cause: error },
      );
    }
    if (
      !isObject(value) ||
      !Array.isArray(value.dados) ||
      !Array.isArray(value.links)
    )
      throw new Error(
        `Câmara deputy ${deputyId} expenses response is malformed`,
      );
    const links = value.links.map((link) => {
      if (
        !isObject(link) ||
        typeof link.rel !== 'string' ||
        typeof link.href !== 'string'
      )
        throw new Error(
          `Câmara deputy ${deputyId} expenses response is malformed`,
        );
      return { rel: link.rel, href: link.href };
    });
    return { dados: value.dados, links };
  }
}

function quoteMoney(json: string): string {
  return json.replace(
    /("(?:valorDocumento|valorGlosa|valorLiquido)"\s*:\s*)(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    '$1"$2"',
  );
}
function parseRecord(
  deputyExternalId: string,
  raw: unknown,
): CamaraParliamentaryExpenseRecord {
  if (
    !isObject(raw) ||
    !Number.isSafeInteger(raw.ano) ||
    !Number.isSafeInteger(raw.mes) ||
    typeof raw.tipoDespesa !== 'string' ||
    typeof raw.codDocumento !== 'string' ||
    typeof raw.valorDocumento !== 'string' ||
    typeof raw.valorGlosa !== 'string' ||
    typeof raw.valorLiquido !== 'string'
  )
    throw new Error(
      `Câmara deputy ${deputyExternalId} expenses response is malformed`,
    );
  return {
    deputyExternalId,
    year: raw.ano as number,
    month: raw.mes as number,
    category: raw.tipoDespesa,
    supplierName: nullableString(raw.nomeFornecedor),
    supplierDocument: nullableString(raw.cnpjCpfFornecedor),
    documentCode: raw.codDocumento,
    batchCode: nullableInteger(raw.codLote),
    reimbursementNumber: nullableString(raw.numRessarcimento),
    installment: nullableInteger(raw.parcela),
    documentNumber: nullableString(raw.numDocumento),
    documentType: nullableString(raw.tipoDocumento),
    documentDate: nullableString(raw.dataDocumento),
    grossValue: raw.valorDocumento,
    netValue: raw.valorLiquido,
    deductionValue: raw.valorGlosa,
    sourceUrl: nullableString(raw.urlDocumento),
  };
}
function nullableString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string')
    throw new Error('Câmara expense string field is malformed');
  return value;
}
function nullableInteger(value: unknown): number | null {
  if (value == null) return null;
  if (!Number.isSafeInteger(value))
    throw new Error('Câmara expense integer field is malformed');
  return value as number;
}
function safeNext(href: string, current: string, base: string): string {
  const next = new URL(href, current);
  if (next.origin !== new URL(base).origin)
    throw new Error('Câmara expense pagination returned an unexpected origin');
  return next.href;
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
