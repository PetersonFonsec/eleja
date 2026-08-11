import {
  LegislativeBody,
  LegislativeMandate,
  ParliamentaryExpense,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import type { NormalizedParliamentaryExpenseData } from '../normalization/normalized-parliamentary-expense-data.js';
type Database = Awaited<ReturnType<typeof initializeDatabase>>;
export type ParliamentaryExpensePersistenceResult =
  | {
      status: 'INSERTED' | 'UPDATED' | 'UNCHANGED';
      expense: ParliamentaryExpense;
      mandateResolved: boolean;
    }
  | { status: 'REJECTED'; code: 'PERSON_IDENTITY_NOT_FOUND' };

export class ParliamentaryExpensePersistenceService {
  constructor(private readonly orm: Database) {}
  async persist(
    data: NormalizedParliamentaryExpenseData,
  ): Promise<ParliamentaryExpensePersistenceResult> {
    return this.orm.em.transactional(async (em) => {
      const identity = await em.findOne(
        PersonExternalIdentity,
        {
          source: PersonExternalIdentitySource.CAMARA,
          externalId: data.deputyExternalId,
        },
        { populate: ['person'] },
      );
      if (!identity)
        return { status: 'REJECTED', code: 'PERSON_IDENTITY_NOT_FOUND' };
      const start =
        data.documentDate ??
        `${data.year}-${String(data.month).padStart(2, '0')}-01`;
      const mandates = await em.find(LegislativeMandate, {
        person: identity.person,
        body: LegislativeBody.CHAMBER_OF_DEPUTIES,
        startedAt: { $lte: start },
        $or: [{ endedAt: null }, { endedAt: { $gte: start } }],
      });
      const mandate = mandates.length === 1 ? (mandates[0] ?? null) : null;
      const existing = await em.findOne(ParliamentaryExpense, {
        source: data.source,
        externalId: data.externalId,
      });
      if (!existing) {
        const expense = new ParliamentaryExpense(
          identity.person,
          data.source,
          data.externalId,
          data.year,
          data.month,
          data.category,
          data.grossValue,
          data.netValue,
          data.deductionValue,
          {
            mandate,
            categoryCode: data.categoryCode,
            supplierName: data.supplierName,
            supplierDocument: data.supplierDocument,
            documentNumber: data.documentNumber,
            documentType: data.documentType,
            documentDate: data.documentDate,
            sourceUrl: data.sourceUrl,
          },
        );
        em.persist(expense);
        await em.flush();
        return {
          status: 'INSERTED',
          expense,
          mandateResolved: mandate !== null,
        };
      }
      if (existing.person.id !== identity.person.id)
        return { status: 'REJECTED', code: 'PERSON_IDENTITY_NOT_FOUND' };
      let changed = false;
      for (const [key, value] of Object.entries({
        mandate,
        year: data.year,
        month: data.month,
        categoryCode: data.categoryCode,
        category: data.category,
        supplierName: data.supplierName,
        supplierDocument: data.supplierDocument,
        documentNumber: data.documentNumber,
        documentType: data.documentType,
        documentDate: data.documentDate,
        grossValue: data.grossValue,
        netValue: data.netValue,
        deductionValue: data.deductionValue,
        sourceUrl: data.sourceUrl,
      }))
        changed =
          assign(existing, key as MutableKey, value as never) || changed;
      if (changed) await em.flush();
      return {
        status: changed ? 'UPDATED' : 'UNCHANGED',
        expense: existing,
        mandateResolved: mandate !== null,
      };
    });
  }
}
type MutableKey = Exclude<
  keyof ParliamentaryExpense,
  'id' | 'person' | 'source' | 'externalId' | 'createdAt' | 'updatedAt'
>;
function assign(
  entity: ParliamentaryExpense,
  key: MutableKey,
  value: unknown,
): boolean {
  const current = entity[key];
  if (
    current === value ||
    (typeof current === 'object' &&
      current &&
      typeof value === 'object' &&
      value &&
      'id' in current &&
      'id' in value &&
      (current as { id: unknown }).id === (value as { id: unknown }).id)
  )
    return false;
  (entity as unknown as Record<string, unknown>)[key] = value;
  return true;
}
