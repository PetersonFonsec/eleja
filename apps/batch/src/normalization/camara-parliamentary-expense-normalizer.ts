import { LegislativeSource } from '@eleja/database';
import type { CamaraParliamentaryExpenseRecord } from '../sources/camara/camara-parliamentary-expense-record.js';
import type { ParliamentaryExpenseNormalizationResult } from './normalized-parliamentary-expense-data.js';

export class CamaraParliamentaryExpenseNormalizer {
  normalize(
    record: CamaraParliamentaryExpenseRecord,
  ): ParliamentaryExpenseNormalizationResult {
    const issues: Array<{ field: string; value: unknown; reason: string }> = [];
    if (!/^\d+$/.test(record.deputyExternalId))
      issues.push(
        issue(
          'deputyExternalId',
          record.deputyExternalId,
          'missing deputy external ID',
        ),
      );
    if (
      !Number.isSafeInteger(record.year) ||
      record.year < 2008 ||
      record.year > 9999
    )
      issues.push(issue('year', record.year, 'invalid year'));
    if (
      !Number.isSafeInteger(record.month) ||
      record.month < 1 ||
      record.month > 12
    )
      issues.push(issue('month', record.month, 'invalid month'));
    if (!record.documentCode.trim())
      issues.push(
        issue(
          'documentCode',
          record.documentCode,
          'missing expense identity fields',
        ),
      );
    const values = [
      parseMoney(record.grossValue),
      parseMoney(record.netValue),
      parseMoney(record.deductionValue),
    ];
    if (values.some((value) => value === null))
      issues.push(
        issue(
          'money',
          [record.grossValue, record.netValue, record.deductionValue],
          'invalid monetary value',
        ),
      );
    const documentDate = parseDate(record.documentDate);
    if (record.documentDate && !documentDate)
      issues.push(issue('documentDate', record.documentDate, 'invalid date'));
    const category = record.category.trim();
    if (!category)
      issues.push(
        issue('category', record.category, 'missing expense category'),
      );
    if (issues.length || !values[0] || !values[1] || !values[2])
      return { status: 'REJECTED', issues };
    const identityParts = [
      record.deputyExternalId,
      record.documentCode.trim(),
      record.batchCode ?? '',
      record.reimbursementNumber?.trim() ?? '',
      record.installment ?? '',
    ];
    return {
      status: 'SUCCESS',
      data: {
        deputyExternalId: record.deputyExternalId,
        source: LegislativeSource.CAMARA,
        externalId: identityParts.join(':'),
        year: record.year,
        month: record.month,
        categoryCode: null,
        category,
        supplierName: clean(record.supplierName),
        supplierDocument: clean(record.supplierDocument),
        documentNumber: clean(record.documentNumber),
        documentType: clean(record.documentType),
        documentDate,
        grossValue: values[0],
        netValue: values[1],
        deductionValue: values[2],
        sourceUrl: clean(record.sourceUrl),
      },
    };
  }
}
export function parseCamaraExpenseMoney(value: string): string | null {
  return parseMoney(value);
}
function parseMoney(value: string): string | null {
  const trimmed = value.trim();
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const [integer, decimals = ''] = trimmed.split('.');
  return `${integer}.${decimals.padEnd(2, '0')}`;
}
function parseDate(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2})?$/.exec(
    value.trim(),
  );
  if (!match) return null;
  const date = match[1]!;
  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.toISOString().slice(0, 10) === date ? date : null;
}
function clean(value: string | null): string | null {
  return value?.trim() || null;
}
function issue(field: string, value: unknown, reason: string) {
  return { field, value, reason };
}
