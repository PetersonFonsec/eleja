import {
  Candidacy,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import { CamaraProposalNormalizer } from '../normalization/camara-proposal-normalizer.js';
import { LegislativeProposalAuthorshipPersistenceService } from '../persistence/legislative-proposal-authorship-persistence.js';
import { LegislativeProposalPersistenceService } from '../persistence/legislative-proposal-persistence.js';
import type {
  CamaraProposalAuthorRecord,
  CamaraProposalRecord,
  CamaraProposalReference,
} from '../sources/camara/camara-proposal-record.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;

export interface CamaraProposalImportSource {
  fetchReferencesByDeputyId(
    deputyExternalId: string,
  ): Promise<CamaraProposalReference[]>;
  fetchProposal(externalId: string): Promise<CamaraProposalRecord>;
  fetchAuthors(externalId: string): Promise<CamaraProposalAuthorRecord[]>;
}

export interface CamaraProposalImportStatistics {
  peopleConsidered: number;
  camaraIdentitiesFound: number;
  deputiesQueried: number;
  proposalReferencesRead: number;
  uniqueProposalsFetched: number;
  proposalsNormalized: number;
  proposalsInserted: number;
  proposalsUpdated: number;
  proposalsUnchanged: number;
  proposalsRejected: number;
  authorRecordsRead: number;
  elejaAuthorsResolved: number;
  authorshipInserted: number;
  authorshipUpdated: number;
  authorshipUnchanged: number;
  authorsNotMapped: number;
  errors: number;
}

export class CamaraProposalImportJob {
  constructor(
    private readonly orm: Database,
    private readonly source: CamaraProposalImportSource,
    private readonly normalizer = new CamaraProposalNormalizer(),
    private readonly proposalPersistence = new LegislativeProposalPersistenceService(
      orm,
    ),
    private readonly authorshipPersistence = new LegislativeProposalAuthorshipPersistenceService(
      orm,
    ),
  ) {}

  async execute(electionYear: number): Promise<CamaraProposalImportStatistics> {
    if (
      !Number.isSafeInteger(electionYear) ||
      electionYear < 1900 ||
      electionYear > 9999
    ) {
      throw new Error('Election year must be an integer between 1900 and 9999');
    }
    const identities = await this.loadPopulationIdentities(electionYear);
    const statistics = emptyStatistics(identities.peopleConsidered);
    statistics.camaraIdentitiesFound = identities.byExternalId.size;
    const references = new Map<string, CamaraProposalReference>();
    for (const identity of identities.byExternalId.values()) {
      statistics.deputiesQueried += 1;
      try {
        const deputyReferences = await this.source.fetchReferencesByDeputyId(
          identity.externalId,
        );
        statistics.proposalReferencesRead += deputyReferences.length;
        for (const reference of deputyReferences) {
          references.set(reference.externalId, reference);
        }
      } catch {
        statistics.errors += 1;
      }
    }

    for (const reference of references.values()) {
      let record: CamaraProposalRecord;
      let authors: CamaraProposalAuthorRecord[];
      try {
        [record, authors] = await Promise.all([
          this.source.fetchProposal(reference.externalId),
          this.source.fetchAuthors(reference.externalId),
        ]);
        statistics.uniqueProposalsFetched += 1;
        statistics.authorRecordsRead += authors.length;
      } catch {
        statistics.proposalsRejected += 1;
        statistics.errors += 1;
        continue;
      }

      const normalized = this.normalizer.normalize(record);
      if (normalized.status === 'REJECTED') {
        statistics.proposalsRejected += 1;
        continue;
      }
      statistics.proposalsNormalized += 1;
      const proposal = await this.proposalPersistence.persist(normalized.data);
      if (proposal.status === 'INSERTED') statistics.proposalsInserted += 1;
      if (proposal.status === 'UPDATED') statistics.proposalsUpdated += 1;
      if (proposal.status === 'UNCHANGED') statistics.proposalsUnchanged += 1;

      for (const author of authors) {
        const result = await this.authorshipPersistence.persist(
          proposal.proposal.id,
          author,
          normalized.data.presentedAt,
        );
        if (result.status === 'AUTHOR_NOT_MAPPED') {
          statistics.authorsNotMapped += 1;
        } else {
          statistics.elejaAuthorsResolved += 1;
          if (result.status === 'INSERTED') statistics.authorshipInserted += 1;
          if (result.status === 'UPDATED') statistics.authorshipUpdated += 1;
          if (result.status === 'UNCHANGED')
            statistics.authorshipUnchanged += 1;
        }
      }
    }
    return statistics;
  }

  private async loadPopulationIdentities(electionYear: number): Promise<{
    peopleConsidered: number;
    byExternalId: Map<string, PersonExternalIdentity>;
  }> {
    const em = this.orm.em.fork();
    const candidacies = await em.find(
      Candidacy,
      { election: { year: electionYear } },
      { populate: ['person'] },
    );
    const personIds = [...new Set(candidacies.map((item) => item.person.id))];
    const identities = personIds.length
      ? await em.find(PersonExternalIdentity, {
          source: PersonExternalIdentitySource.CAMARA,
          person: { id: { $in: personIds } },
        })
      : [];
    return {
      peopleConsidered: personIds.length,
      byExternalId: new Map(
        identities.map((identity) => [identity.externalId, identity]),
      ),
    };
  }
}

function emptyStatistics(
  peopleConsidered: number,
): CamaraProposalImportStatistics {
  return {
    peopleConsidered,
    camaraIdentitiesFound: 0,
    deputiesQueried: 0,
    proposalReferencesRead: 0,
    uniqueProposalsFetched: 0,
    proposalsNormalized: 0,
    proposalsInserted: 0,
    proposalsUpdated: 0,
    proposalsUnchanged: 0,
    proposalsRejected: 0,
    authorRecordsRead: 0,
    elejaAuthorsResolved: 0,
    authorshipInserted: 0,
    authorshipUpdated: 0,
    authorshipUnchanged: 0,
    authorsNotMapped: 0,
    errors: 0,
  };
}
