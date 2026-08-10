import { CamaraApiClient } from './camara-api-client.js';
import type { CamaraDeputyMandateRecord } from './camara-deputy-mandate-record.js';

interface HistoryEvent {
  id: number;
  idLegislatura: number;
  siglaUf: string | null;
  siglaPartido: string | null;
  dataHora: string;
  situacao: string | null;
  descricaoStatus: string | null;
}

interface LegislaturePeriod {
  startedAt: string;
  endedAt: string;
}

export class CamaraDeputyMandateSource {
  private readonly legislaturePeriods = new Map<number, LegislaturePeriod>();

  constructor(private readonly client = new CamaraApiClient()) {}

  async fetchByDeputyId(
    deputyExternalId: string,
  ): Promise<CamaraDeputyMandateRecord[]> {
    if (!/^\d+$/.test(deputyExternalId)) {
      throw new Error('Câmara deputy identifier must contain only digits');
    }
    const deputyId = Number(deputyExternalId);
    if (!Number.isSafeInteger(deputyId)) {
      throw new Error('Câmara deputy identifier is outside the safe range');
    }

    const value = await this.client.fetchJson(
      this.client.resolve(`deputados/${deputyExternalId}/historico`),
      `deputy ${deputyExternalId} mandate history`,
    );
    const events = parseHistoryResponse(value, deputyId);
    const legislatureNumbers = [
      ...new Set(events.map((event) => event.idLegislatura)),
    ];
    await Promise.all(
      legislatureNumbers.map((number) => this.loadLegislature(number)),
    );

    return events.map((event) => {
      const period = this.legislaturePeriods.get(event.idLegislatura);
      if (!period) {
        throw new Error(
          `Câmara legislature ${event.idLegislatura} was not loaded`,
        );
      }
      return {
        deputyExternalId,
        legislatureNumber: event.idLegislatura,
        state: event.siglaUf,
        partyAcronym: event.siglaPartido,
        occurredAt: event.dataHora,
        situation: event.situacao,
        statusDescription: event.descricaoStatus,
        legislatureStartedAt: period.startedAt,
        legislatureEndedAt: period.endedAt,
      };
    });
  }

  private async loadLegislature(number: number): Promise<void> {
    if (this.legislaturePeriods.has(number)) return;
    const value = await this.client.fetchJson(
      this.client.resolve(`legislaturas/${number}`),
      `legislature ${number}`,
    );
    if (!isObject(value) || !isObject(value.dados)) {
      throw new Error(`Câmara legislature ${number} response is malformed`);
    }
    const data = value.dados;
    if (
      data.id !== number ||
      typeof data.dataInicio !== 'string' ||
      !isDateOnly(data.dataInicio) ||
      typeof data.dataFim !== 'string' ||
      !isDateOnly(data.dataFim) ||
      data.dataFim < data.dataInicio
    ) {
      throw new Error(`Câmara legislature ${number} response is malformed`);
    }
    this.legislaturePeriods.set(number, {
      startedAt: data.dataInicio,
      endedAt: data.dataFim,
    });
  }
}

function parseHistoryResponse(
  value: unknown,
  deputyId: number,
): HistoryEvent[] {
  if (!isObject(value) || !Array.isArray(value.dados)) {
    throw new Error(
      `Câmara deputy ${deputyId} mandate history response is malformed`,
    );
  }
  return value.dados.map((item) => {
    if (
      !isObject(item) ||
      item.id !== deputyId ||
      !Number.isSafeInteger(item.idLegislatura) ||
      (item.siglaUf !== null && typeof item.siglaUf !== 'string') ||
      (item.siglaPartido !== null && typeof item.siglaPartido !== 'string') ||
      typeof item.dataHora !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(item.dataHora) ||
      (item.situacao !== null && typeof item.situacao !== 'string') ||
      (item.descricaoStatus !== null &&
        typeof item.descricaoStatus !== 'string')
    ) {
      throw new Error(
        `Câmara deputy ${deputyId} mandate history response is malformed`,
      );
    }
    return {
      id: item.id,
      idLegislatura: item.idLegislatura as number,
      siglaUf: item.siglaUf as string | null,
      siglaPartido: item.siglaPartido as string | null,
      dataHora: item.dataHora,
      situacao: item.situacao as string | null,
      descricaoStatus: item.descricaoStatus as string | null,
    };
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDateOnly(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
