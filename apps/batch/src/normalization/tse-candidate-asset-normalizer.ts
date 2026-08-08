import type { CandidateAssetNormalizationResult } from './normalized-candidate-asset-data.js';
import type { TseCandidateAssetRecord } from '../sources/tse/tse-candidate-asset-record.js';
import { parseTseDeclaredValue } from '../sources/tse/tse-candidate-asset-parser.js';

export class TseCandidateAssetNormalizer {
  normalize(
    record: TseCandidateAssetRecord,
  ): CandidateAssetNormalizationResult {
    const sourceCandidateId = record.candidateId.trim();
    const typeCode = record.typeCode.trim();
    const type = record.typeDescription.trim();
    const value = parseTseDeclaredValue(record.declaredValue);
    if (!sourceCandidateId)
      return rejected(
        'sourceCandidateId',
        record.candidateId,
        'missing candidate source identifier',
      );
    if (
      !Number.isSafeInteger(record.sourceSequence) ||
      record.sourceSequence <= 0
    )
      return rejected(
        'sourceSequence',
        record.sourceSequence,
        'invalid source sequence',
      );
    if (!typeCode || !type)
      return rejected(
        'type',
        record.typeDescription,
        'missing required asset type',
      );
    if (!value)
      return rejected('value', record.declaredValue, 'invalid monetary value');
    return {
      status: 'SUCCESS',
      data: {
        sourceCandidateId,
        asset: {
          sourceSequence: record.sourceSequence,
          typeCode,
          type,
          description: record.description.trim() || null,
          value,
        },
      },
    };
  }
}

function rejected(
  field: string,
  value: unknown,
  reason: string,
): CandidateAssetNormalizationResult {
  return { status: 'REJECTED', issue: { field, value, reason } };
}
