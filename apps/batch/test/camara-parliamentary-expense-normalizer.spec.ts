import { describe, expect, it } from 'vitest';
import {
  CamaraParliamentaryExpenseNormalizer,
  parseCamaraExpenseMoney,
} from '../src/normalization/camara-parliamentary-expense-normalizer.js';

describe('CamaraParliamentaryExpenseNormalizer', () => {
  it.each([
    ['0', '0.00'],
    ['0.10', '0.10'],
    ['1000', '1000.00'],
    ['1000.01', '1000.01'],
    ['999999999.99', '999999999.99'],
  ])('parses %s exactly', (input, expected) =>
    expect(parseCamaraExpenseMoney(input)).toBe(expected),
  );
  it('preserves gross, deduction and net independently and builds a stable identity', () => {
    const result = new CamaraParliamentaryExpenseNormalizer().normalize(
      record(),
    );
    expect(result).toMatchObject({
      status: 'SUCCESS',
      data: {
        externalId: '10:123:99:R1:2',
        grossValue: '1000.01',
        deductionValue: '0.10',
        netValue: '999.91',
        documentDate: '2025-07-01',
      },
    });
  });
  it.each([0, 13])('rejects invalid month %s', (month) =>
    expect(
      new CamaraParliamentaryExpenseNormalizer().normalize(record({ month }))
        .status,
    ).toBe('REJECTED'),
  );
  it('rejects invalid dates and money instead of producing zero', () => {
    const result = new CamaraParliamentaryExpenseNormalizer().normalize(
      record({ documentDate: '2025-02-31', netValue: 'one' }),
    );
    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED')
      expect(result.issues.map((item) => item.reason)).toEqual(
        expect.arrayContaining(['invalid monetary value', 'invalid date']),
      );
  });
});
function record(overrides: Record<string, unknown> = {}) {
  return {
    deputyExternalId: '10',
    year: 2025,
    month: 7,
    category: ' PASSAGENS ',
    supplierName: 'Fornecedor',
    supplierDocument: '123',
    documentCode: '123',
    batchCode: 99,
    reimbursementNumber: 'R1',
    installment: 2,
    documentNumber: 'NF',
    documentType: 'Nota Fiscal',
    documentDate: '2025-07-01T00:00:00',
    grossValue: '1000.01',
    deductionValue: '0.10',
    netValue: '999.91',
    sourceUrl: null,
    ...overrides,
  } as never;
}
