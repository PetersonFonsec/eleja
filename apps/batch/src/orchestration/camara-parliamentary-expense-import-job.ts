import {
  Candidacy,
  LegislativeBody,
  LegislativeMandate,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import { CamaraParliamentaryExpenseNormalizer } from '../normalization/camara-parliamentary-expense-normalizer.js';
import { ParliamentaryExpensePersistenceService } from '../persistence/parliamentary-expense-persistence.js';
import type {
  CamaraParliamentaryExpenseQuery,
  CamaraParliamentaryExpenseRecord,
} from '../sources/camara/camara-parliamentary-expense-record.js';
type Database = Awaited<ReturnType<typeof initializeDatabase>>;
export interface CamaraExpenseImportSource {
  fetchExpenses(
    query: CamaraParliamentaryExpenseQuery,
  ): Promise<CamaraParliamentaryExpenseRecord[]>;
}
export interface CamaraExpenseImportStatistics {
  peopleConsidered: number;
  camaraIdentitiesFound: number;
  mandatesConsidered: number;
  queries: number;
  expenseRecordsRead: number;
  normalized: number;
  normalizationRejected: number;
  expensesInserted: number;
  expensesUpdated: number;
  expensesUnchanged: number;
  persistenceRejected: number;
  identityNotFound: number;
  mandateUnresolved: number;
  errors: number;
}
export class CamaraParliamentaryExpenseImportJob {
  constructor(
    private readonly orm: Database,
    private readonly source: CamaraExpenseImportSource,
    private readonly normalizer = new CamaraParliamentaryExpenseNormalizer(),
    private readonly persistence = new ParliamentaryExpensePersistenceService(
      orm,
    ),
  ) {}
  async execute(electionYear: number): Promise<CamaraExpenseImportStatistics> {
    if (
      !Number.isSafeInteger(electionYear) ||
      electionYear < 1900 ||
      electionYear > 9999
    )
      throw new Error('Election year must be an integer between 1900 and 9999');
    const population = await this.loadPopulation(electionYear);
    const stats = emptyStats(
      population.people,
      population.identities.length,
      population.mandates.length,
    );
    const identitiesByPerson = new Map(
      population.identities.map((identity) => [identity.person.id, identity]),
    );
    const queries = new Map<string, CamaraParliamentaryExpenseQuery>();
    const todayYear = new Date().getUTCFullYear();
    for (const mandate of population.mandates) {
      if (!mandate.startedAt || !mandate.legislatureNumber) continue;
      const identity = identitiesByPerson.get(mandate.person.id);
      if (!identity) continue;
      const endYear = mandate.endedAt
        ? Number(mandate.endedAt.slice(0, 4))
        : todayYear;
      for (
        let year = Math.max(2008, Number(mandate.startedAt.slice(0, 4)));
        year <= endYear;
        year += 1
      ) {
        const query = {
          deputyExternalId: identity.externalId,
          legislatureNumber: mandate.legislatureNumber,
          year,
        };
        queries.set(
          `${identity.externalId}:${mandate.legislatureNumber}:${year}`,
          query,
        );
      }
    }
    for (const query of queries.values()) {
      stats.queries += 1;
      let records: CamaraParliamentaryExpenseRecord[];
      try {
        records = await this.source.fetchExpenses(query);
      } catch {
        stats.errors += 1;
        continue;
      }
      stats.expenseRecordsRead += records.length;
      for (const record of records) {
        const normalized = this.normalizer.normalize(record);
        if (normalized.status === 'REJECTED') {
          stats.normalizationRejected += 1;
          continue;
        }
        stats.normalized += 1;
        const result = await this.persistence.persist(normalized.data);
        if (result.status === 'REJECTED') {
          stats.persistenceRejected += 1;
          stats.identityNotFound += 1;
          continue;
        }
        if (!result.mandateResolved) stats.mandateUnresolved += 1;
        if (result.status === 'INSERTED') stats.expensesInserted += 1;
        else if (result.status === 'UPDATED') stats.expensesUpdated += 1;
        else stats.expensesUnchanged += 1;
      }
    }
    return stats;
  }
  private async loadPopulation(year: number) {
    const em = this.orm.em.fork();
    const candidacies = await em.find(
      Candidacy,
      { election: { year } },
      { populate: ['person'] },
    );
    const ids = [...new Set(candidacies.map((item) => item.person.id))];
    const identities = ids.length
      ? await em.find(
          PersonExternalIdentity,
          {
            source: PersonExternalIdentitySource.CAMARA,
            person: { id: { $in: ids } },
          },
          { populate: ['person'] },
        )
      : [];
    const personIds = identities.map((item) => item.person.id);
    const mandates = personIds.length
      ? await em.find(
          LegislativeMandate,
          {
            body: LegislativeBody.CHAMBER_OF_DEPUTIES,
            person: { id: { $in: personIds } },
          },
          { populate: ['person'] },
        )
      : [];
    return { people: ids.length, identities, mandates };
  }
}
function emptyStats(
  peopleConsidered: number,
  camaraIdentitiesFound: number,
  mandatesConsidered: number,
): CamaraExpenseImportStatistics {
  return {
    peopleConsidered,
    camaraIdentitiesFound,
    mandatesConsidered,
    queries: 0,
    expenseRecordsRead: 0,
    normalized: 0,
    normalizationRejected: 0,
    expensesInserted: 0,
    expensesUpdated: 0,
    expensesUnchanged: 0,
    persistenceRejected: 0,
    identityNotFound: 0,
    mandateUnresolved: 0,
    errors: 0,
  };
}
