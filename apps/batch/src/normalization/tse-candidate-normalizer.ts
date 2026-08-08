import type { TseCandidateRecord } from '../sources/tse/tse-candidate-record.js';
import type {
  CandidateNormalizationIssue,
  CandidateNormalizationResult,
  NormalizedCandidateData,
} from './normalized-candidate-data.js';
import {
  TSE_CANDIDACY_STATUS_MAPPINGS,
  TSE_ELECTION_TYPE_MAPPINGS,
  TSE_OFFICE_MAPPINGS,
} from './tse-candidate-mappings.js';

const BRAZILIAN_UFS = new Set([
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

export class TseCandidateNormalizer {
  normalize(record: TseCandidateRecord): CandidateNormalizationResult {
    if (
      !Number.isSafeInteger(record.electionYear) ||
      record.electionYear < 1800 ||
      record.electionYear > 9999
    ) {
      return rejected(
        record,
        'electionYear',
        String(record.electionYear),
        'invalid election year',
      );
    }
    const sourceCandidateId = normalizeRequired(record.candidateId);
    if (!sourceCandidateId) {
      return rejected(
        record,
        'candidateId',
        record.candidateId,
        'missing canonical-required value',
      );
    }

    const officeCode = normalizeRequired(record.officeSourceCode);
    const officeDescription = normalizeRequired(record.officeDescription);
    const office = TSE_OFFICE_MAPPINGS.find(
      (mapping) =>
        mapping.sourceCode === officeCode &&
        mapping.sourceDescription === officeDescription,
    );
    if (!office) {
      return rejected(
        record,
        'office',
        `${officeCode ?? ''}|${officeDescription ?? ''}`,
        'unsupported office',
      );
    }

    const electionTypeKey = `${record.electionTypeCode}|${normalizeRequired(record.electionType) ?? ''}`;
    const supportedElectionTypes = TSE_ELECTION_TYPE_MAPPINGS[electionTypeKey];
    if (!supportedElectionTypes?.includes(office.electionType)) {
      return rejected(
        record,
        'electionType',
        electionTypeKey,
        'unsupported election type',
      );
    }

    if (record.electionRound !== 1 && record.electionRound !== 2) {
      return rejected(
        record,
        'electionRound',
        String(record.electionRound),
        'unsupported election round',
      );
    }

    const sourceStatus = normalizeOptional(record.candidacyStatus);
    const status = sourceStatus
      ? TSE_CANDIDACY_STATUS_MAPPINGS[sourceStatus]
      : undefined;
    if (!status) {
      return rejected(
        record,
        'candidacyStatus',
        sourceStatus ?? '',
        'unsupported candidacy status',
      );
    }

    const geographic = normalizeGeographicContext(record, office.scope);
    if ('issue' in geographic) {
      return { status: 'REJECTED', issue: geographic.issue };
    }

    const requiredValues = {
      partyName: normalizeRequired(record.partyName),
      partyAcronym: normalizeRequired(record.partyAcronym)?.toUpperCase(),
      personName: normalizeRequired(record.candidateFullName),
      ballotName: normalizeRequired(record.candidateBallotName),
      birthDate: normalizeRequired(record.birthDate),
    };
    for (const [field, value] of Object.entries(requiredValues)) {
      if (!value) {
        return rejected(record, field, '', 'missing canonical-required value');
      }
    }
    if (!isIsoDate(requiredValues.birthDate!)) {
      return rejected(
        record,
        'birthDate',
        record.birthDate,
        'invalid canonical date',
      );
    }
    if (
      !Number.isSafeInteger(record.candidateBallotNumber) ||
      record.candidateBallotNumber <= 0
    ) {
      return rejected(
        record,
        'candidateBallotNumber',
        String(record.candidateBallotNumber),
        'invalid ballot number',
      );
    }
    if (!Number.isSafeInteger(record.partyNumber) || record.partyNumber <= 0) {
      return rejected(
        record,
        'partyNumber',
        String(record.partyNumber),
        'invalid party number',
      );
    }

    const data: NormalizedCandidateData = {
      election: {
        year: record.electionYear,
        type: office.electionType,
        round: record.electionRound,
      },
      party: {
        sourcePartyId: normalizeOptional(record.partySourceId),
        name: requiredValues.partyName!,
        acronym: requiredValues.partyAcronym!,
        number: record.partyNumber,
      },
      office: {
        sourceCode: office.sourceCode,
        code: office.code,
        name: office.name,
        scope: office.scope,
      },
      person: {
        name: requiredValues.personName!,
        birthDate: requiredValues.birthDate!,
        gender: normalizeOptional(record.gender),
        education: normalizeOptional(record.education),
        occupation: normalizeOptional(record.occupation),
      },
      candidacy: {
        sourceCandidateId,
        ballotName: requiredValues.ballotName!,
        ballotNumber: record.candidateBallotNumber,
        state: geographic.state,
        city: geographic.city,
        photoUrl: null,
        status,
        sourceStatus,
      },
    };
    return { status: 'SUCCESS', data };
  }
}

function normalizeGeographicContext(
  record: TseCandidateRecord,
  scope: NormalizedCandidateData['office']['scope'],
):
  | { state: string | null; city: string | null }
  | { issue: CandidateNormalizationIssue } {
  const sourceState = normalizeRequired(record.state)?.toUpperCase();
  if (scope === 'NATIONAL') {
    if (sourceState !== 'BR') {
      return {
        issue: issue(
          record,
          'state',
          sourceState ?? '',
          'invalid national geographic code',
        ),
      };
    }
    return { state: null, city: null };
  }
  if (!sourceState || !BRAZILIAN_UFS.has(sourceState)) {
    return { issue: issue(record, 'state', sourceState ?? '', 'invalid UF') };
  }
  if (scope === 'MUNICIPAL') {
    const city = normalizeOptional(record.electoralUnitName);
    if (!city) {
      return {
        issue: issue(
          record,
          'city',
          record.electoralUnitName,
          'missing canonical-required value',
        ),
      };
    }
    return { state: sourceState, city };
  }
  return { state: sourceState, city: null };
}

function normalizeRequired(value: string): string | undefined {
  return normalizeOptional(value) ?? undefined;
}

function normalizeOptional(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function rejected(
  record: TseCandidateRecord,
  field: string,
  sourceValue: string,
  reason: string,
): CandidateNormalizationResult {
  return {
    status: 'REJECTED',
    issue: issue(record, field, sourceValue, reason),
  };
}

function issue(
  record: TseCandidateRecord,
  field: string,
  sourceValue: string,
  reason: string,
): CandidateNormalizationIssue {
  return {
    sourceCandidateId: normalizeOptional(record.candidateId) ?? '',
    field,
    sourceValue,
    reason,
  };
}
