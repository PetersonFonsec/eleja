export interface CamaraParliamentaryExpenseQuery {
  deputyExternalId: string;
  legislatureNumber: number;
  year: number;
}
export interface CamaraParliamentaryExpenseRecord {
  deputyExternalId: string;
  year: number;
  month: number;
  category: string;
  supplierName: string | null;
  supplierDocument: string | null;
  documentCode: string;
  batchCode: number | null;
  reimbursementNumber: string | null;
  installment: number | null;
  documentNumber: string | null;
  documentType: string | null;
  documentDate: string | null;
  grossValue: string;
  netValue: string;
  deductionValue: string;
  sourceUrl: string | null;
}
