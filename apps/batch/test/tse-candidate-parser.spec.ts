import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import yazl from 'yazl';
import {
  assertSafeArchiveEntry,
  TseCandidateDatasetParser,
} from '../src/sources/tse/tse-candidate-parser.js';
import type {
  TseCandidateParseResult,
  TseCandidateParsingStatistics,
} from '../src/sources/tse/tse-candidate-record.js';

const HEADERS = [
  'ANO_ELEICAO',
  'CD_TIPO_ELEICAO',
  'NM_TIPO_ELEICAO',
  'NR_TURNO',
  'SQ_CANDIDATO',
  'NM_CANDIDATO',
  'NM_URNA_CANDIDATO',
  'NR_CANDIDATO',
  'NR_PARTIDO',
  'SG_PARTIDO',
  'NM_PARTIDO',
  'CD_CARGO',
  'DS_CARGO',
  'SG_UF',
  'SG_UE',
  'NM_UE',
  'DT_NASCIMENTO',
  'DS_GENERO',
  'DS_GRAU_INSTRUCAO',
  'DS_OCUPACAO',
  'DS_SITUACAO_CANDIDATURA',
  'NM_SOCIAL_CANDIDATO',
  'NR_CPF_CANDIDATO',
  'SG_UF_NASCIMENTO',
];

const VALID_VALUES = [
  '2026',
  '2',
  'ELEIÇÃO ORDINÁRIA',
  '1',
  '280001234567',
  'JOÃO; "JÚNIOR" GONÇALVES',
  'JOÃO GONÇALVES',
  '13',
  '13',
  'PT',
  'PARTIDO DOS TRABALHADORES',
  '6',
  'DEPUTADO FEDERAL',
  'SP',
  'SP',
  'SÃO PAULO',
  '29/02/1980',
  'MASCULINO',
  'SUPERIOR COMPLETO',
  'PROFESSOR DE EDUCAÇÃO',
  'APTO',
  '',
  '12345678901',
  'MG',
];

function csvRow(values: string[]): string {
  return values.map((value) => `"${value.replaceAll('"', '""')}"`).join(';');
}

function latin1(value: string): Buffer {
  return Buffer.from(value, 'latin1');
}

function zipWithCsv(csv: string, entryName = 'consulta_cand_2026_BRASIL.csv') {
  const zip = new yazl.ZipFile();
  zip.addBuffer(latin1(csv), entryName);
  zip.end();
  return zip.outputStream as Readable;
}

async function consume(
  iterator: AsyncGenerator<
    TseCandidateParseResult,
    TseCandidateParsingStatistics
  >,
) {
  const results: TseCandidateParseResult[] = [];
  let next = await iterator.next();
  while (!next.done) {
    results.push(next.value);
    next = await iterator.next();
  }
  return { results, statistics: next.value };
}

describe('TseCandidateDatasetParser', () => {
  it('streams a real-format Latin-1 row with quotes, delimiter and empty optional field', async () => {
    const csv = `${csvRow(HEADERS)}\r\n${csvRow(VALID_VALUES)}\r\n`;

    const { results, statistics } = await consume(
      new TseCandidateDatasetParser().parse(zipWithCsv(csv), 2026),
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      status: 'SUCCESS',
      record: expect.objectContaining({
        electionYear: 2026,
        candidateId: '280001234567',
        candidateFullName: 'JOÃO; "JÚNIOR" GONÇALVES',
        candidateCpf: '12345678901',
        electoralUnitName: 'SÃO PAULO',
        birthDate: '1980-02-29',
        birthState: 'MG',
        education: 'SUPERIOR COMPLETO',
        occupation: 'PROFESSOR DE EDUCAÇÃO',
        gender: 'MASCULINO',
        officeDescription: 'DEPUTADO FEDERAL',
      }),
    });
    expect(statistics).toMatchObject({
      csvEntry: 'consulta_cand_2026_BRASIL.csv',
      encoding: 'ISO-8859-1',
      delimiter: ';',
      recordsRead: 1,
      recordsParsed: 1,
      recordsRejected: 0,
    });
  });

  it('supports LF line endings', async () => {
    const csv = `${csvRow(HEADERS)}\n${csvRow(VALID_VALUES)}\n`;

    const { statistics } = await consume(
      new TseCandidateDatasetParser().parse(zipWithCsv(csv), 2026),
    );

    expect(statistics.recordsParsed).toBe(1);
  });

  it.each([
    {
      name: 'invalid integer',
      field: 'NR_CANDIDATO',
      value: '13x',
      reason: 'invalid integer',
    },
    {
      name: 'invalid date',
      field: 'DT_NASCIMENTO',
      value: '31/02/1980',
      reason: 'invalid date, expected DD/MM/YYYY',
    },
    {
      name: 'missing required value',
      field: 'NM_CANDIDATO',
      value: '',
      reason: 'missing required source field',
    },
  ])('rejects a row with $name', async ({ field, value, reason }) => {
    const values = [...VALID_VALUES];
    values[HEADERS.indexOf(field)] = value;
    const csv = `${csvRow(HEADERS)}\r\n${csvRow(values)}\r\n`;

    const { results, statistics } = await consume(
      new TseCandidateDatasetParser().parse(zipWithCsv(csv), 2026),
    );

    expect(results).toEqual([
      {
        status: 'REJECTED',
        issue: expect.objectContaining({ field, value, reason }),
      },
    ]);
    expect(statistics).toMatchObject({
      recordsRead: 1,
      recordsParsed: 0,
      recordsRejected: 1,
    });
  });

  it('reports and continues after a malformed CSV row', async () => {
    const malformed = csvRow(VALID_VALUES.slice(0, -1));
    const csv = [csvRow(HEADERS), malformed, csvRow(VALID_VALUES), ''].join(
      '\r\n',
    );

    const { results, statistics } = await consume(
      new TseCandidateDatasetParser().parse(zipWithCsv(csv), 2026),
    );

    expect(results.map((result) => result.status)).toEqual([
      'REJECTED',
      'SUCCESS',
    ]);
    expect(results[0]).toEqual({
      status: 'REJECTED',
      issue: expect.objectContaining({
        reason: expect.stringContaining('malformed CSV row'),
      }),
    });
    expect(statistics).toMatchObject({
      recordsRead: 2,
      recordsParsed: 1,
      recordsRejected: 1,
    });
  });

  it('fails early when a required header is missing', async () => {
    const headers = HEADERS.filter((header) => header !== 'NM_CANDIDATO');
    const values = VALID_VALUES.filter(
      (_value, index) => HEADERS[index] !== 'NM_CANDIDATO',
    );
    const csv = `${csvRow(headers)}\r\n${csvRow(values)}\r\n`;

    await expect(
      consume(new TseCandidateDatasetParser().parse(zipWithCsv(csv), 2026)),
    ).rejects.toThrow(
      'TSE candidate dataset schema is incompatible: missing required column NM_CANDIDATO',
    );
  });

  it('requires the explicit consolidated candidate entry', async () => {
    const csv = `${csvRow(HEADERS)}\r\n${csvRow(VALID_VALUES)}\r\n`;

    await expect(
      consume(
        new TseCandidateDatasetParser().parse(
          zipWithCsv(csv, 'consulta_cand_2026_SP.csv'),
          2026,
        ),
      ),
    ).rejects.toThrow(
      'does not contain required entry consulta_cand_2026_BRASIL.csv',
    );
  });
});

describe('assertSafeArchiveEntry', () => {
  it.each(['../evil.csv', '../../file', '/absolute/file', 'C:\\evil.csv'])(
    'rejects unsafe ZIP path %s',
    (entryPath) => {
      expect(() => assertSafeArchiveEntry(entryPath)).toThrow(
        'Unsafe ZIP entry path',
      );
    },
  );

  it('accepts the expected flat TSE entry', () => {
    expect(() =>
      assertSafeArchiveEntry('consulta_cand_2026_BRASIL.csv'),
    ).not.toThrow();
  });
});
