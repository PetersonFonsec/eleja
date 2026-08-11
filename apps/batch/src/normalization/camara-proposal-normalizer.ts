import { LegislativeSource } from '@eleja/database';
import type { CamaraProposalRecord } from '../sources/camara/camara-proposal-record.js';
import type { LegislativeProposalNormalizationResult } from './normalized-legislative-proposal-data.js';

export class CamaraProposalNormalizer {
  normalize(
    record: CamaraProposalRecord,
  ): LegislativeProposalNormalizationResult {
    const reject = (
      reason: string,
    ): LegislativeProposalNormalizationResult => ({
      status: 'REJECTED',
      issue: { externalId: record.externalId, reason },
    });
    if (!/^\d+$/.test(record.externalId)) {
      return reject('Proposal external identifier must contain only digits');
    }
    const type = record.type.trim().toUpperCase();
    if (!type) return reject('Proposal type must not be empty');
    if (!Number.isSafeInteger(record.number) || record.number <= 0) {
      return reject('Proposal number must be a positive integer');
    }
    if (
      !Number.isSafeInteger(record.year) ||
      record.year < 1800 ||
      record.year > 9999
    ) {
      return reject('Proposal year must be a four-digit year');
    }
    if (!isOfficialCamaraUrl(record.sourceUrl)) {
      return reject('Proposal URL must use the official Câmara API');
    }
    if (record.presentedAt !== null && !isDateOnly(record.presentedAt)) {
      return reject('Proposal presentation date must be YYYY-MM-DD');
    }

    return {
      status: 'NORMALIZED',
      data: {
        source: LegislativeSource.CAMARA,
        externalId: record.externalId,
        type,
        number: record.number,
        year: record.year,
        title: null,
        summary: normalizeNullableText(record.summary),
        status: null,
        sourceStatus: normalizeNullableText(record.sourceStatus),
        url: record.sourceUrl,
        presentedAt: record.presentedAt,
      },
    };
  }
}

function normalizeNullableText(value: string | null): string | null {
  return value?.trim() || null;
}

function isOfficialCamaraUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'dadosabertos.camara.leg.br' &&
      url.pathname.startsWith('/api/v2/proposicoes/')
    );
  } catch {
    return false;
  }
}

function isDateOnly(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
