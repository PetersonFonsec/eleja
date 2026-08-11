import { LegislativeVotePosition } from '@eleja/database';
import type { CamaraDeputyVoteRecord } from '../sources/camara/camara-voting-record.js';
import type {
  NormalizationResult,
  NormalizedLegislativeVoteData,
} from './normalized-legislative-voting-data.js';

const MAPPING: Readonly<Record<string, LegislativeVotePosition>> = {
  sim: LegislativeVotePosition.YES,
  não: LegislativeVotePosition.NO,
  nao: LegislativeVotePosition.NO,
  abstenção: LegislativeVotePosition.ABSTENTION,
  abstencao: LegislativeVotePosition.ABSTENTION,
  obstrução: LegislativeVotePosition.OBSTRUCTION,
  obstrucao: LegislativeVotePosition.OBSTRUCTION,
};

export class CamaraDeputyVoteNormalizer {
  normalize(
    record: CamaraDeputyVoteRecord,
  ): NormalizationResult<NormalizedLegislativeVoteData> {
    const issues: Array<{ reason: string }> = [];
    if (!record.deputyExternalId || !/^\d+$/.test(record.deputyExternalId))
      issues.push({ reason: 'Missing deputy external ID' });
    if (
      record.registeredAt !== null &&
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(record.registeredAt)
    )
      issues.push({ reason: 'Invalid individual vote timestamp' });
    if (issues.length || !record.deputyExternalId)
      return { status: 'REJECTED', issues };
    const sourcePosition = record.sourcePosition.trim();
    const position =
      MAPPING[sourcePosition.toLocaleLowerCase('pt-BR')] ??
      LegislativeVotePosition.OTHER;
    const resultIssues =
      position === LegislativeVotePosition.OTHER
        ? [{ reason: `Unsupported vote position: ${sourcePosition}` }]
        : [];
    return {
      status: 'NORMALIZED',
      data: {
        votingExternalId: record.votingExternalId,
        deputyExternalId: record.deputyExternalId,
        position,
        sourcePosition,
        votedAt: record.registeredAt
          ? new Date(`${record.registeredAt}Z`)
          : null,
      },
      issues: resultIssues,
    };
  }
}
