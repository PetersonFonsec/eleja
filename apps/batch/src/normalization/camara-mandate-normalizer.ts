import { LegislativeBody, LegislativeMandateStatus } from '@eleja/database';
import type { CamaraDeputyMandateRecord } from '../sources/camara/camara-deputy-mandate-record.js';
import type { LegislativeMandateNormalizationResult } from './normalized-legislative-mandate-data.js';

const VALID_UFS = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]);

const STATUS_MAPPING: Readonly<Record<string, LegislativeMandateStatus>> = {
  Exercício: LegislativeMandateStatus.ACTIVE,
  Afastado: LegislativeMandateStatus.INTERRUPTED,
  Convocado: LegislativeMandateStatus.INTERRUPTED,
  Licença: LegislativeMandateStatus.INTERRUPTED,
  Suplência: LegislativeMandateStatus.INTERRUPTED,
  Suspenso: LegislativeMandateStatus.INTERRUPTED,
  'Fim de Mandato': LegislativeMandateStatus.COMPLETED,
  Vacância: LegislativeMandateStatus.COMPLETED,
};

export class CamaraMandateNormalizer {
  constructor(
    private readonly asOfDate = new Date().toISOString().slice(0, 10),
  ) {}

  normalize(
    records: readonly CamaraDeputyMandateRecord[],
  ): LegislativeMandateNormalizationResult[] {
    const groups = new Map<string, CamaraDeputyMandateRecord[]>();
    for (const record of records) {
      const key = `${record.deputyExternalId}\u0000${record.legislatureNumber}`;
      const group = groups.get(key) ?? [];
      group.push(record);
      groups.set(key, group);
    }
    return [...groups.values()].map((group) =>
      this.normalizeLegislature(group),
    );
  }

  private normalizeLegislature(
    records: CamaraDeputyMandateRecord[],
  ): LegislativeMandateNormalizationResult {
    records.sort((left, right) =>
      left.occurredAt.localeCompare(right.occurredAt),
    );
    const first = records[0];
    if (!first) throw new Error('Câmara mandate group must not be empty');
    const reject = (reason: string): LegislativeMandateNormalizationResult => ({
      status: 'REJECTED',
      issue: {
        deputyExternalId: first.deputyExternalId,
        legislatureNumber: first.legislatureNumber,
        reason,
      },
    });
    if (
      records.some(
        (record) =>
          record.deputyExternalId !== first.deputyExternalId ||
          record.legislatureNumber !== first.legislatureNumber ||
          record.legislatureStartedAt !== first.legislatureStartedAt ||
          record.legislatureEndedAt !== first.legislatureEndedAt,
      )
    ) {
      return reject('Inconsistent Câmara mandate history group');
    }

    const exercise = records.find((record) => record.situation === 'Exercício');
    if (!exercise) return reject('Mandate history has no exercise entry');
    const startedAt = exercise.occurredAt.slice(0, 10);
    if (
      startedAt < first.legislatureStartedAt ||
      startedAt > first.legislatureEndedAt
    ) {
      return reject('Mandate start falls outside the legislature period');
    }

    const latestWithSituation = [...records]
      .reverse()
      .find((record) => record.situation !== null);
    const sourceStatus = latestWithSituation?.situation ?? null;
    let status = sourceStatus
      ? (STATUS_MAPPING[sourceStatus] ?? LegislativeMandateStatus.UNKNOWN)
      : LegislativeMandateStatus.UNKNOWN;
    let endedAt: string | null = null;

    if (first.legislatureEndedAt < this.asOfDate) {
      status = LegislativeMandateStatus.COMPLETED;
      endedAt = first.legislatureEndedAt;
    } else if (
      latestWithSituation &&
      (status === LegislativeMandateStatus.COMPLETED ||
        status === LegislativeMandateStatus.INTERRUPTED)
    ) {
      endedAt = latestWithSituation.occurredAt.slice(0, 10);
    }
    if (endedAt !== null && endedAt < startedAt) {
      return reject('Mandate end precedes mandate start');
    }

    const latestState = latestNonNull(records, (record) => record.state);
    const state = latestState?.trim().toUpperCase() ?? null;
    if (state !== null && !VALID_UFS.has(state)) {
      return reject(`Mandate state is not a valid UF: ${state}`);
    }
    const partyAcronym =
      latestNonNull(records, (record) => record.partyAcronym)
        ?.trim()
        .toUpperCase() ?? null;

    return {
      status: 'NORMALIZED',
      data: {
        personExternalId: first.deputyExternalId,
        mandate: {
          body: LegislativeBody.CHAMBER_OF_DEPUTIES,
          externalMandateId: null,
          legislatureNumber: first.legislatureNumber,
          state,
          partyAcronym,
          startedAt,
          endedAt,
          status,
          sourceStatus,
        },
      },
    };
  }
}

function latestNonNull(
  records: readonly CamaraDeputyMandateRecord[],
  select: (record: CamaraDeputyMandateRecord) => string | null,
): string | null {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (!record) continue;
    const value = select(record);
    if (value !== null && value.trim()) return value;
  }
  return null;
}
