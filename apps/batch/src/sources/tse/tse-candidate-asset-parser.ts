import { parse as parseCsv, type Options } from 'csv-parse';
import { Transform, type Readable } from 'node:stream';
import unzipper from 'unzipper';
import { assertSafeArchiveEntry } from './tse-candidate-parser.js';
import {
  REQUIRED_TSE_CANDIDATE_ASSET_COLUMNS,
  TSE_CANDIDATE_ASSET_COLUMNS as COLUMN,
} from './tse-candidate-asset-columns.js';
import type {
  TseCandidateAssetParseResult,
  TseCandidateAssetParsingStatistics,
  TseCandidateAssetRecord,
} from './tse-candidate-asset-record.js';

type SourceRow = Record<string, string>;

export class TseCandidateAssetDatasetParser {
  async *parse(
    rawArchive: Readable,
    electionYear: number,
  ): AsyncGenerator<
    TseCandidateAssetParseResult,
    TseCandidateAssetParsingStatistics
  > {
    const expectedEntry = `bem_candidato_${electionYear}_BRASIL.csv`;
    const archive = rawArchive.pipe(unzipper.Parse({ forceStream: true }));
    let selected = 0;
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
      if (++selected > 1)
        throw new Error(`Duplicate ZIP entry ${expectedEntry}`);
      const skippedIssues: Array<{
        rowNumber: number;
        reason: string;
      }> = [];
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
      const csv = entry.pipe(latin1Decoder()).pipe(parseCsv(csvOptions));
      for await (const row of csv) {
        while (skippedIssues.length > 0) {
          recordsRead += 1;
          recordsRejected += 1;
          yield { status: 'REJECTED', issue: skippedIssues.shift()! };
        }
        recordsRead += 1;
        const result = mapRow(row as SourceRow, recordsRead + 1);
        if (result.status === 'SUCCESS') recordsParsed += 1;
        else recordsRejected += 1;
        yield result;
      }
      while (skippedIssues.length > 0) {
        recordsRead += 1;
        recordsRejected += 1;
        yield { status: 'REJECTED', issue: skippedIssues.shift()! };
      }
    }
    if (selected === 0) {
      throw new Error(`Asset archive missing required entry ${expectedEntry}`);
    }
    return {
      csvEntry: expectedEntry,
      encoding: 'ISO-8859-1',
      delimiter: ';',
      recordsRead,
      recordsParsed,
      recordsRejected,
    };
  }
}

function validateHeaders(headers: string[]): string[] {
  const missing = REQUIRED_TSE_CANDIDATE_ASSET_COLUMNS.filter(
    (header) => !headers.includes(header),
  );
  if (missing.length) {
    throw new Error(
      `Asset dataset missing required column ${missing.join(', ')}`,
    );
  }
  return headers;
}

function mapRow(
  row: SourceRow,
  rowNumber: number,
): TseCandidateAssetParseResult {
  for (const field of [
    COLUMN.candidateId,
    COLUMN.sourceSequence,
    COLUMN.typeCode,
    COLUMN.typeDescription,
    COLUMN.declaredValue,
  ]) {
    if (!row[field]?.trim())
      return rejected(
        rowNumber,
        field,
        row[field],
        'missing required source field',
      );
  }
  const year = integer(row[COLUMN.electionYear]);
  const sequence = integer(row[COLUMN.sourceSequence]);
  if (year === undefined)
    return rejected(
      rowNumber,
      COLUMN.electionYear,
      row[COLUMN.electionYear],
      'invalid integer',
    );
  if (sequence === undefined || sequence <= 0)
    return rejected(
      rowNumber,
      COLUMN.sourceSequence,
      row[COLUMN.sourceSequence],
      'invalid positive integer',
    );
  if (!parseTseDeclaredValue(row[COLUMN.declaredValue]!))
    return rejected(
      rowNumber,
      COLUMN.declaredValue,
      row[COLUMN.declaredValue],
      'invalid monetary value',
    );
  const record: TseCandidateAssetRecord = {
    electionYear: year,
    candidateId: row[COLUMN.candidateId]!,
    sourceSequence: sequence,
    typeCode: row[COLUMN.typeCode]!,
    typeDescription: row[COLUMN.typeDescription]!,
    description: row[COLUMN.description] ?? '',
    declaredValue: row[COLUMN.declaredValue]!,
  };
  return { status: 'SUCCESS', record };
}

export function parseTseDeclaredValue(value: string): string | undefined {
  const trimmed = value.trim();
  if (!/^-?\d+(?:,\d{1,2})?$/.test(trimmed)) return undefined;
  const negative = trimmed.startsWith('-');
  const [integerPart, fraction = ''] = (
    negative ? trimmed.slice(1) : trimmed
  ).split(',');
  const normalizedInteger = integerPart!.replace(/^0+(?=\d)/, '');
  const normalizedFraction = fraction.padEnd(2, '0');
  const sign =
    negative && (normalizedInteger !== '0' || normalizedFraction !== '00')
      ? '-'
      : '';
  return `${sign}${normalizedInteger}.${normalizedFraction}`;
}

function integer(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function rejected(
  rowNumber: number,
  field: string,
  value: string | undefined,
  reason: string,
): TseCandidateAssetParseResult {
  return { status: 'REJECTED', issue: { rowNumber, field, value, reason } };
}

function latin1Decoder(): Transform {
  const decoder = new TextDecoder('iso-8859-1', { fatal: true });
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      try {
        callback(null, decoder.decode(chunk, { stream: true }));
      } catch (error) {
        callback(error as Error);
      }
    },
    flush(callback) {
      try {
        callback(null, decoder.decode());
      } catch (error) {
        callback(error as Error);
      }
    },
  });
}
