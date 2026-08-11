import type { LegislativeSource } from '@eleja/database';
export interface NormalizedParliamentaryExpenseData {
  deputyExternalId: string;
  source: LegislativeSource;
  externalId: string;
  year: number;
  month: number;
  categoryCode: string | null;
  category: string;
  supplierName: string | null;
  supplierDocument: string | null;
  documentNumber: string | null;
  documentType: string | null;
  documentDate: string | null;
  grossValue: string;
  netValue: string;
  deductionValue: string;
  sourceUrl: string | null;
}
export type ParliamentaryExpenseNormalizationResult =
  | { status: 'SUCCESS'; data: NormalizedParliamentaryExpenseData }
  | {
      status: 'REJECTED';
      issues: Array<{ field: string; value: unknown; reason: string }>;
    };
