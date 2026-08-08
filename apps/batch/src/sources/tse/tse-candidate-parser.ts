import { Transform, type Readable } from 'node:stream';
import { posix, win32 } from 'node:path';
import { parse as parseCsv, type Options } from 'csv-parse';
import unzipper from 'unzipper';
import {
  REQUIRED_TSE_CANDIDATE_COLUMNS,
  TSE_CANDIDATE_COLUMNS as COLUMN,
} from './tse-candidate-columns.js';
import type {
  TseCandidateParseIssue,
  TseCandidateParseResult,
  TseCandidateParsingStatistics,
  TseCandidateRecord,
} from './tse-candidate-record.js';

type SourceRow = Record<string, string>;

export class TseCandidateDatasetParser {
  async *parse(
    rawArchive: Readable,
    electionYear: number,
  ): AsyncGenerator<TseCandidateParseResult, TseCandidateParsingStatistics> {
    const startedAt = performance.now();
    const expectedEntry = `consulta_cand_${electionYear}_BRASIL.csv`;
    const archive = rawArchive.pipe(unzipper.Parse({ forceStream: true }));
    let selectedEntries = 0;
    let recordsRead = 0;
    let recordsParsed = 0;
    let recordsRejected = 0;

    for await (const entry of archive) {
      const entryPath = String(entry.path);
      assertSafeArchiveEntry(entryPath);

      if (entry.type !== 'File' || entryPath !== expectedEntry) {
        entry.autodrain();
        continue;
      }

      selectedEntries += 1;
      if (selectedEntries > 1) {
        entry.autodrain();
        throw new Error(
          `TSE candidate archive contains duplicate entry ${expectedEntry}`,
        );
      }

      const skippedIssues: TseCandidateParseIssue[] = [];
      const csvOptions: Options = {
        bom: true,
        columns: (headers) => validateHeaders(headers as string[]),
        delimiter: ';',
        quote: '"',
        skip_records_with_error: true,
        on_skip: (error) => {
          skippedIssues.push({
            rowNumber:
              typeof error?.lines === 'number' ? error.lines : recordsRead + 2,
            reason: `malformed CSV row: ${error?.message ?? 'unknown CSV error'}`,
          });
        },
      };
      const csv = entry.pipe(createLatin1Decoder()).pipe(parseCsv(csvOptions));

      for await (const row of csv) {
        while (skippedIssues.length > 0) {
          recordsRead += 1;
          recordsRejected += 1;
          yield { status: 'REJECTED', issue: skippedIssues.shift()! };
        }

        recordsRead += 1;
        const result = mapSourceRow(row as SourceRow, recordsRead + 1);
        if (result.status === 'SUCCESS') {
          recordsParsed += 1;
        } else {
          recordsRejected += 1;
        }
        yield result;
      }

      while (skippedIssues.length > 0) {
        recordsRead += 1;
        recordsRejected += 1;
        yield { status: 'REJECTED', issue: skippedIssues.shift()! };
      }
    }

    if (selectedEntries === 0) {
      throw new Error(
        `TSE candidate archive does not contain required entry ${expectedEntry}`,
      );
    }

    return {
      csvEntry: expectedEntry,
      encoding: 'ISO-8859-1',
      delimiter: ';',
      recordsRead,
      recordsParsed,
      recordsRejected,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}

export function assertSafeArchiveEntry(entryPath: string): void {
  const segments = entryPath.replaceAll('\\', '/').split('/');
  if (
    entryPath.includes('\0') ||
    posix.isAbsolute(entryPath) ||
    win32.isAbsolute(entryPath) ||
    segments.includes('..')
  ) {
    throw new Error(`Unsafe ZIP entry path: ${entryPath}`);
  }
}

function createLatin1Decoder(): Transform {
  const decoder = new TextDecoder('iso-8859-1', { fatal: true });
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      try {
        callback(null, decoder.decode(chunk, { stream: true }));
      } catch (error: unknown) {
        callback(error as Error);
      }
    },
    flush(callback) {
      try {
        callback(null, decoder.decode());
      } catch (error: unknown) {
        callback(error as Error);
      }
    },
  });
}

function validateHeaders(headers: string[]): string[] {
  const missing = REQUIRED_TSE_CANDIDATE_COLUMNS.filter(
    (column) => !headers.includes(column),
  );
  if (missing.length > 0) {
    throw new Error(
      `TSE candidate dataset schema is incompatible: missing required column ${missing.join(', ')}`,
    );
  }
  return headers;
}

function mapSourceRow(
  row: SourceRow,
  rowNumber: number,
): TseCandidateParseResult {
  const requiredStrings = [
    COLUMN.electionType,
    COLUMN.candidateId,
    COLUMN.candidateFullName,
    COLUMN.candidateBallotName,
    COLUMN.partyAcronym,
    COLUMN.partyName,
    COLUMN.officeCode,
    COLUMN.officeDescription,
    COLUMN.state,
    COLUMN.electoralUnitCode,
    COLUMN.electoralUnitName,
    COLUMN.gender,
    COLUMN.education,
    COLUMN.occupation,
    COLUMN.candidacyStatus,
  ];
  for (const field of requiredStrings) {
    if (!row[field]?.trim()) {
      return rejected(
        rowNumber,
        field,
        row[field],
        'missing required source field',
      );
    }
  }

  const integers = [
    COLUMN.electionYear,
    COLUMN.electionTypeCode,
    COLUMN.electionRound,
    COLUMN.candidateBallotNumber,
    COLUMN.partyNumber,
  ] as const;
  const parsedIntegers = new Map<string, number>();
  for (const field of integers) {
    const value = row[field];
    if (!value || !/^-?\d+$/.test(value)) {
      return rejected(rowNumber, field, value, 'invalid integer');
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      return rejected(rowNumber, field, value, 'integer outside safe range');
    }
    parsedIntegers.set(field, parsed);
  }

  const birthDate = parseBrazilianDate(row[COLUMN.birthDate]);
  if (!birthDate) {
    return rejected(
      rowNumber,
      COLUMN.birthDate,
      row[COLUMN.birthDate],
      'invalid date, expected DD/MM/YYYY',
    );
  }

  const partyNumber = parsedIntegers.get(COLUMN.partyNumber)!;
  const record: TseCandidateRecord = {
    electionYear: parsedIntegers.get(COLUMN.electionYear)!,
    electionTypeCode: parsedIntegers.get(COLUMN.electionTypeCode)!,
    electionType: row[COLUMN.electionType]!,
    electionRound: parsedIntegers.get(COLUMN.electionRound)!,
    candidateId: row[COLUMN.candidateId]!,
    candidateFullName: row[COLUMN.candidateFullName]!,
    candidateBallotName: row[COLUMN.candidateBallotName]!,
    candidateBallotNumber: parsedIntegers.get(COLUMN.candidateBallotNumber)!,
    partySourceId: String(partyNumber),
    partyAcronym: row[COLUMN.partyAcronym]!,
    partyName: row[COLUMN.partyName]!,
    partyNumber,
    officeSourceCode: row[COLUMN.officeCode]!,
    officeDescription: row[COLUMN.officeDescription]!,
    state: row[COLUMN.state]!,
    electoralUnitCode: row[COLUMN.electoralUnitCode]!,
    electoralUnitName: row[COLUMN.electoralUnitName]!,
    birthDate,
    gender: row[COLUMN.gender]!,
    education: row[COLUMN.education]!,
    occupation: row[COLUMN.occupation]!,
    candidacyStatus: row[COLUMN.candidacyStatus]!,
  };
  return { status: 'SUCCESS', record };
}

function parseBrazilianDate(value: string | undefined): string | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value ?? '');
  if (!match) return undefined;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return undefined;
  }
  return `${yearText}-${monthText}-${dayText}`;
}

function rejected(
  rowNumber: number,
  field: string,
  value: string | undefined,
  reason: string,
): TseCandidateParseResult {
  return { status: 'REJECTED', issue: { rowNumber, field, value, reason } };
}
