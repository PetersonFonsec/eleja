import {
  LegislativeBody,
  LegislativeMandate,
  LegislativeSource,
  ParliamentaryExpense,
  Person,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ParliamentaryExpensePersistenceService } from '../src/persistence/parliamentary-expense-persistence.js';

describe('ParliamentaryExpensePersistenceService', () => {
  let orm: Awaited<ReturnType<typeof initializeDatabase>>;
  beforeAll(async () => {
    orm = await initializeDatabase();
  });
  afterAll(async () => {
    await orm.close();
  });
  it('resolves identity and mandate, preserves exact money, updates and remains idempotent', async () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const person = new Person(`Pessoa despesa ${suffix}`);
    const identity = new PersonExternalIdentity(
      person,
      PersonExternalIdentitySource.CAMARA,
      `7${Date.now()}`,
    );
    const mandate = new LegislativeMandate(
      person,
      LegislativeBody.CHAMBER_OF_DEPUTIES,
      { legislatureNumber: 57, startedAt: '2023-02-01', endedAt: '2027-01-31' },
    );
    const setup = orm.em.fork();
    setup.persist([person, identity, mandate]);
    await setup.flush();
    const data = {
      deputyExternalId: identity.externalId,
      source: LegislativeSource.CAMARA,
      externalId: `${identity.externalId}:doc:lot::0`,
      year: 2025,
      month: 7,
      categoryCode: null,
      category: 'COMBUSTÍVEIS',
      supplierName: 'Fornecedor',
      supplierDocument: '00.000.000/0001-00',
      documentNumber: 'NF-1',
      documentType: 'Nota Fiscal',
      documentDate: '2025-07-01',
      grossValue: '1000.01',
      netValue: '999.91',
      deductionValue: '0.10',
      sourceUrl: 'https://www.camara.leg.br/doc.pdf',
    };
    const service = new ParliamentaryExpensePersistenceService(orm);
    try {
      expect((await service.persist(data)).status).toBe('INSERTED');
      expect((await service.persist(data)).status).toBe('UNCHANGED');
      expect(
        (
          await service.persist({
            ...data,
            supplierName: 'Fornecedor corrigido',
          })
        ).status,
      ).toBe('UPDATED');
      expect(
        (
          await service.persist({
            ...data,
            externalId: `${data.externalId}:second`,
            supplierName: 'Fornecedor corrigido',
          })
        ).status,
      ).toBe('INSERTED');
      const rows = await orm.em
        .fork()
        .find(
          ParliamentaryExpense,
          { person },
          { populate: ['person', 'mandate'] },
        );
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        grossValue: '1000.01',
        netValue: '999.91',
        deductionValue: '0.10',
      });
      expect(rows.every((row) => row.mandate?.id === mandate.id)).toBe(true);
    } finally {
      const cleanup = orm.em.fork();
      await cleanup.nativeDelete(ParliamentaryExpense, { person });
      await cleanup.nativeDelete(LegislativeMandate, mandate.id);
      await cleanup.nativeDelete(PersonExternalIdentity, identity.id);
      await cleanup.nativeDelete(Person, person.id);
    }
  });
  it('rejects an unmapped deputy without creating a person', async () => {
    const service = new ParliamentaryExpensePersistenceService(orm);
    const externalId = randomUUID();
    const result = await service.persist({
      deputyExternalId: `missing-${randomUUID()}`,
      source: LegislativeSource.CAMARA,
      externalId,
      year: 2025,
      month: 1,
      categoryCode: null,
      category: 'TESTE',
      supplierName: null,
      supplierDocument: null,
      documentNumber: null,
      documentType: null,
      documentDate: null,
      grossValue: '0.00',
      netValue: '0.00',
      deductionValue: '0.00',
      sourceUrl: null,
    });
    expect(result).toEqual({
      status: 'REJECTED',
      code: 'PERSON_IDENTITY_NOT_FOUND',
    });
    expect(
      await orm.em.fork().count(ParliamentaryExpense, { externalId }),
    ).toBe(0);
  });
});
