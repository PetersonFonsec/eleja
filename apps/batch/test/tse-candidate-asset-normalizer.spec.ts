import { describe, expect, it } from 'vitest';
import { TseCandidateAssetNormalizer } from '../src/normalization/tse-candidate-asset-normalizer.js';
import type { TseCandidateAssetRecord } from '../src/sources/tse/tse-candidate-asset-record.js';
import { parseTseDeclaredValue } from '../src/sources/tse/tse-candidate-asset-parser.js';

const record: TseCandidateAssetRecord = {
  electionYear: 2026,
  candidateId: ' 280001 ',
  sourceSequence: 1,
  typeCode: ' 21 ',
  typeDescription: ' Veículo ',
  description: ' Automóvel; modelo especial ',
  declaredValue: '150000,00',
};

describe('TSE candidate asset normalization', () => {
  it.each([
    ['0', '0.00'],
    ['10', '10.00'],
    ['10,5', '10.50'],
    ['150000,00', '150000.00'],
    ['-38101,07', '-38101.07'],
    ['-0,00', '0.00'],
    ['9999999999999999999999,99', '9999999999999999999999.99'],
  ])('parses %s exactly as %s', (source, expected) => {
    expect(parseTseDeclaredValue(source)).toBe(expected);
  });

  it.each(['', '10.000,00', '--1,00', 'abc', '1,234'])(
    'rejects invalid monetary value %j',
    (source) => expect(parseTseDeclaredValue(source)).toBeUndefined(),
  );

  it('normalizes without rewriting official descriptions', () => {
    expect(new TseCandidateAssetNormalizer().normalize(record)).toEqual({
      status: 'SUCCESS',
      data: {
        sourceCandidateId: '280001',
        asset: {
          sourceSequence: 1,
          typeCode: '21',
          type: 'Veículo',
          description: 'Automóvel; modelo especial',
          value: '150000.00',
        },
      },
    });
  });

  it('rejects invalid monetary input instead of converting it to zero', () => {
    expect(
      new TseCandidateAssetNormalizer().normalize({
        ...record,
        declaredValue: 'invalid',
      }),
    ).toMatchObject({ status: 'REJECTED', issue: { field: 'value' } });
  });
});
