import {
  Candidacy,
  Election,
  ElectionType,
  LegislativeBody,
  LegislativeMandate,
  Office,
  OfficeScope,
  ParliamentaryExpense,
  Party,
  Person,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CamaraParliamentaryExpenseImportJob } from '../src/orchestration/camara-parliamentary-expense-import-job.js';

describe('CamaraParliamentaryExpenseImportJob', () => {
  let orm: Awaited<ReturnType<typeof initializeDatabase>>;
  beforeAll(async () => {
    orm = await initializeDatabase();
  });
  afterAll(async () => {
    await orm.close();
  });
  it('uses mandate years and imports the fixture idempotently', async () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
    const year = 6000 + Math.floor(Math.random() * 3000);
    const election = new Election(year, ElectionType.GENERAL, 1);
    const party = new Party(`Partido ${suffix}`, `E${suffix}`);
    const office = new Office(
      `EXP_${suffix}`,
      `Cargo ${suffix}`,
      OfficeScope.STATE,
    );
    const person = new Person(`Pessoa ${suffix}`);
    const candidacy = new Candidacy(
      person,
      election,
      party,
      office,
      `PESSOA ${suffix}`,
      { sourceCandidateId: `expense-${suffix}` },
    );
    const identity = new PersonExternalIdentity(
      person,
      PersonExternalIdentitySource.CAMARA,
      `8${Date.now()}`,
    );
    const mandate = new LegislativeMandate(
      person,
      LegislativeBody.CHAMBER_OF_DEPUTIES,
      { legislatureNumber: 57, startedAt: '2025-01-01', endedAt: '2025-12-31' },
    );
    const setup = orm.em.fork();
    setup.persist([
      election,
      party,
      office,
      person,
      candidacy,
      identity,
      mandate,
    ]);
    await setup.flush();
    const source = {
      fetchExpenses: vi.fn(async () => [
        {
          deputyExternalId: identity.externalId,
          year: 2025,
          month: 6,
          category: 'COMBUSTÍVEIS',
          supplierName: 'Fornecedor',
          supplierDocument: '123',
          documentCode: 'DOC',
          batchCode: 1,
          reimbursementNumber: null,
          installment: 0,
          documentNumber: 'NF',
          documentType: 'Nota Fiscal',
          documentDate: '2025-06-10',
          grossValue: '10',
          netValue: '9.90',
          deductionValue: '0.10',
          sourceUrl: null,
        },
      ]),
    };
    try {
      const job = new CamaraParliamentaryExpenseImportJob(orm, source);
      const first = await job.execute(year);
      const second = await job.execute(year);
      expect(first).toMatchObject({
        peopleConsidered: 1,
        camaraIdentitiesFound: 1,
        mandatesConsidered: 1,
        queries: 1,
        expenseRecordsRead: 1,
        expensesInserted: 1,
        mandateUnresolved: 0,
      });
      expect(second).toMatchObject({
        expensesInserted: 0,
        expensesUnchanged: 1,
      });
      expect(source.fetchExpenses).toHaveBeenCalledWith({
        deputyExternalId: identity.externalId,
        legislatureNumber: 57,
        year: 2025,
      });
      expect(await orm.em.fork().count(ParliamentaryExpense, { person })).toBe(
        1,
      );
    } finally {
      const cleanup = orm.em.fork();
      await cleanup.nativeDelete(ParliamentaryExpense, { person });
      await cleanup.nativeDelete(LegislativeMandate, mandate.id);
      await cleanup.nativeDelete(PersonExternalIdentity, identity.id);
      await cleanup.nativeDelete(Candidacy, candidacy.id);
      await cleanup.nativeDelete(Person, person.id);
      await cleanup.nativeDelete(Election, election.id);
      await cleanup.nativeDelete(Party, party.id);
      await cleanup.nativeDelete(Office, office.id);
    }
  });
});
