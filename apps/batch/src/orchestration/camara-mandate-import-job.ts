import {
  Candidacy,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import { CamaraMandateNormalizer } from '../normalization/camara-mandate-normalizer.js';
import { LegislativeMandatePersistenceService } from '../persistence/legislative-mandate-persistence.js';
import type { CamaraDeputyMandateRecord } from '../sources/camara/camara-deputy-mandate-record.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;

export interface CamaraMandateHistorySource {
  fetchByDeputyId(
    deputyExternalId: string,
  ): Promise<CamaraDeputyMandateRecord[]>;
}

export interface CamaraMandateImportStatistics {
  peopleConsidered: number;
  camaraIdentitiesFound: number;
  deputiesQueried: number;
  mandateRecordsRead: number;
  normalized: number;
  inserted: number;
  updated: number;
  unchanged: number;
  normalizationRejected: number;
  identityMissing: number;
  errors: number;
}

export class CamaraMandateImportJob {
  constructor(
    private readonly orm: Database,
    private readonly source: CamaraMandateHistorySource,
    private readonly normalizer = new CamaraMandateNormalizer(),
    private readonly persistence = new LegislativeMandatePersistenceService(
      orm,
    ),
  ) {}

  async execute(electionYear: number): Promise<CamaraMandateImportStatistics> {
    if (
      !Number.isSafeInteger(electionYear) ||
      electionYear < 1900 ||
      electionYear > 9999
    ) {
      throw new Error('Election year must be an integer between 1900 and 9999');
    }
    const em = this.orm.em.fork();
    const candidacies = await em.find(
      Candidacy,
      { election: { year: electionYear } },
      { populate: ['person'] },
    );
    const personIds = [
      ...new Set(candidacies.map((candidacy) => candidacy.person.id)),
    ];
    const identities = personIds.length
      ? await em.find(PersonExternalIdentity, {
          source: PersonExternalIdentitySource.CAMARA,
          person: { id: { $in: personIds } },
        })
      : [];
    const uniqueIdentities = new Map(
      identities.map((identity) => [identity.externalId, identity]),
    );
    const statistics: CamaraMandateImportStatistics = {
      peopleConsidered: personIds.length,
      camaraIdentitiesFound: uniqueIdentities.size,
      deputiesQueried: 0,
      mandateRecordsRead: 0,
      normalized: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      normalizationRejected: 0,
      identityMissing: 0,
      errors: 0,
    };

    for (const identity of uniqueIdentities.values()) {
      statistics.deputiesQueried += 1;
      let records;
      try {
        records = await this.source.fetchByDeputyId(identity.externalId);
      } catch {
        statistics.errors += 1;
        continue;
      }
      statistics.mandateRecordsRead += records.length;
      for (const result of this.normalizer.normalize(records)) {
        if (result.status === 'REJECTED') {
          statistics.normalizationRejected += 1;
          continue;
        }
        statistics.normalized += 1;
        const persisted = await this.persistence.persist(result.data);
        if (persisted.status === 'PERSON_IDENTITY_NOT_FOUND') {
          statistics.identityMissing += 1;
        } else if (persisted.status === 'INSERTED') {
          statistics.inserted += 1;
        } else if (persisted.status === 'UPDATED') {
          statistics.updated += 1;
        } else {
          statistics.unchanged += 1;
        }
      }
    }
    return statistics;
  }
}
