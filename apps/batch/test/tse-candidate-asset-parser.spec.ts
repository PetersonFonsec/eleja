import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import yazl from 'yazl';
import { TseCandidateAssetDatasetParser } from '../src/sources/tse/tse-candidate-asset-parser.js';

const headers = [
  'ANO_ELEICAO',
  'SQ_CANDIDATO',
  'NR_ORDEM_BEM_CANDIDATO',
  'CD_TIPO_BEM_CANDIDATO',
  'DS_TIPO_BEM_CANDIDATO',
  'DS_BEM_CANDIDATO',
  'VR_BEM_CANDIDATO',
];
const values = [
  '2026',
  '280001',
  '1',
  '21',
  'Veículo automotor',
  'Automóvel; edição "Especial"',
  '150000,00',
];
const row = (items: string[]) =>
  items.map((item) => `"${item.replaceAll('"', '""')}"`).join(';');

function archive(csv: string, name = 'bem_candidato_2026_BRASIL.csv') {
  const zip = new yazl.ZipFile();
  zip.addBuffer(Buffer.from(csv, 'latin1'), name);
  zip.end();
  return zip.outputStream as Readable;
}

async function consume(csv: string, name?: string) {
  const iterator = new TseCandidateAssetDatasetParser().parse(
    archive(csv, name),
    2026,
  );
  const results = [];
  let next = await iterator.next();
  while (!next.done) {
    results.push(next.value);
    next = await iterator.next();
  }
  return { results, statistics: next.value };
}

describe('TseCandidateAssetDatasetParser', () => {
  it('parses the official Latin-1 format with Portuguese text and delimiters', async () => {
    const parsed = await consume(`${row(headers)}\r\n${row(values)}\r\n`);
    expect(parsed.results[0]).toEqual({
      status: 'SUCCESS',
      record: expect.objectContaining({
        candidateId: '280001',
        sourceSequence: 1,
        typeDescription: 'Veículo automotor',
        description: 'Automóvel; edição "Especial"',
        declaredValue: '150000,00',
      }),
    });
    expect(parsed.statistics).toMatchObject({
      recordsRead: 1,
      recordsParsed: 1,
      encoding: 'ISO-8859-1',
      delimiter: ';',
    });
  });

  it.each([
    ['SQ_CANDIDATO', '', 'missing required source field'],
    ['VR_BEM_CANDIDATO', 'invalid', 'invalid monetary value'],
  ])('rejects invalid %s', async (field, value, reason) => {
    const changed = [...values];
    changed[headers.indexOf(field)] = value;
    const parsed = await consume(`${row(headers)}\r\n${row(changed)}\r\n`);
    expect(parsed.results[0]).toMatchObject({
      status: 'REJECTED',
      issue: { field, reason },
    });
  });

  it('rejects a missing required header', async () => {
    await expect(
      consume(`${row(headers.slice(1))}\r\n${row(values.slice(1))}\r\n`),
    ).rejects.toThrow('ANO_ELEICAO');
  });

  it('reports a malformed row and continues incrementally', async () => {
    const malformed = row(values.slice(0, -1));
    const parsed = await consume(
      `${row(headers)}\r\n${malformed}\r\n${row(values)}\r\n`,
    );
    expect(parsed.results.map((result) => result.status)).toEqual([
      'REJECTED',
      'SUCCESS',
    ]);
    expect(parsed.results[0]).toMatchObject({
      issue: { reason: expect.stringContaining('malformed CSV row') },
    });
  });
});
