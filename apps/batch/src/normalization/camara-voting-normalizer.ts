import { LegislativeSource, LegislativeVotingResult } from '@eleja/database';
import type { CamaraVotingRecord } from '../sources/camara/camara-voting-record.js';
import type {
  NormalizationResult,
  NormalizedLegislativeVotingData,
} from './normalized-legislative-voting-data.js';

export class CamaraVotingNormalizer {
  normalize(
    record: CamaraVotingRecord,
  ): NormalizationResult<NormalizedLegislativeVotingData> {
    const issues: Array<{ reason: string }> = [];
    if (!record.externalId.trim())
      issues.push({ reason: 'Invalid voting external ID' });
    if (!isTimestamp(record.registeredAt))
      issues.push({ reason: 'Invalid voting timestamp' });
    if (
      record.proposalExternalId !== null &&
      !/^\d+$/.test(record.proposalExternalId)
    )
      issues.push({ reason: 'Malformed proposal reference' });
    if (issues.length) return { status: 'REJECTED', issues };
    return {
      status: 'NORMALIZED',
      data: {
        source: LegislativeSource.CAMARA,
        externalId: record.externalId.trim(),
        dateTime: new Date(`${record.registeredAt}Z`),
        description: clean(record.description),
        result:
          record.approval === 1
            ? LegislativeVotingResult.APPROVED
            : record.approval === 0
              ? LegislativeVotingResult.REJECTED
              : LegislativeVotingResult.UNKNOWN,
        sourceResult: record.approval === null ? null : String(record.approval),
        proposalExternalId: record.proposalExternalId,
        sourceUrl: record.sourceUrl,
      },
      issues: [],
    };
  }
}

function clean(value: string | null): string | null {
  return value?.trim() || null;
}
function isTimestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}Z`))
  );
}
