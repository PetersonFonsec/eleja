import {
  Candidacy,
  LegislativeBody,
  LegislativeMandate,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import { CamaraDeputyVoteNormalizer } from '../normalization/camara-deputy-vote-normalizer.js';
import { CamaraVotingNormalizer } from '../normalization/camara-voting-normalizer.js';
import { LegislativeVotePersistenceService } from '../persistence/legislative-vote-persistence.js';
import { LegislativeVotingPersistenceService } from '../persistence/legislative-voting-persistence.js';
import type {
  CamaraDeputyVoteRecord,
  CamaraVotingPeriod,
  CamaraVotingRecord,
} from '../sources/camara/camara-voting-record.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;
export interface CamaraVotingImportSource {
  fetchVotings(period: CamaraVotingPeriod): Promise<CamaraVotingRecord[]>;
  fetchVotes(votingExternalId: string): Promise<CamaraDeputyVoteRecord[]>;
}

export interface CamaraVotingImportStatistics {
  peopleConsidered: number;
  camaraIdentities: number;
  mandatesConsidered: number;
  votingEventsRead: number;
  uniqueVotingEvents: number;
  votingEventsInserted: number;
  votingEventsUpdated: number;
  votingEventsUnchanged: number;
  votingEventsRejected: number;
  individualVotesRead: number;
  elejaVotesResolved: number;
  votesInserted: number;
  votesUpdated: number;
  votesUnchanged: number;
  unmappedDeputies: number;
  voteNormalizationRejected: number;
  errors: number;
}

export class CamaraVotingImportJob {
  constructor(
    private readonly orm: Database,
    private readonly source: CamaraVotingImportSource,
    private readonly votingNormalizer = new CamaraVotingNormalizer(),
    private readonly voteNormalizer = new CamaraDeputyVoteNormalizer(),
    private readonly votingPersistence = new LegislativeVotingPersistenceService(
      orm,
    ),
    private readonly votePersistence = new LegislativeVotePersistenceService(
      orm,
    ),
  ) {}

  async execute(electionYear: number): Promise<CamaraVotingImportStatistics> {
    if (
      !Number.isSafeInteger(electionYear) ||
      electionYear < 1900 ||
      electionYear > 9999
    )
      throw new Error('Election year must be an integer between 1900 and 9999');
    const population = await this.loadPopulation(electionYear);
    const statistics = emptyStatistics(
      population.peopleConsidered,
      population.identities.size,
      population.mandates.length,
    );
    const events = new Map<string, CamaraVotingRecord>();
    for (const period of buildPeriods(population.mandates)) {
      const records = await this.source.fetchVotings(period);
      statistics.votingEventsRead += records.length;
      for (const record of records) events.set(record.externalId, record);
    }
    statistics.uniqueVotingEvents = events.size;

    for (const record of events.values()) {
      const normalizedVoting = this.votingNormalizer.normalize(record);
      if (normalizedVoting.status === 'REJECTED') {
        statistics.votingEventsRejected += 1;
        continue;
      }
      let rawVotes: CamaraDeputyVoteRecord[];
      try {
        rawVotes = await this.source.fetchVotes(record.externalId);
      } catch {
        statistics.errors += 1;
        continue;
      }
      statistics.individualVotesRead += rawVotes.length;
      const latest = latestVotesByDeputy(rawVotes);
      const resolved: Array<{
        identity: PersonExternalIdentity;
        vote: ReturnType<CamaraDeputyVoteNormalizer['normalize']> & {
          status: 'NORMALIZED';
        };
      }> = [];
      for (const rawVote of latest.values()) {
        const vote = this.voteNormalizer.normalize(rawVote);
        if (vote.status === 'REJECTED') {
          statistics.voteNormalizationRejected += 1;
          continue;
        }
        if (vote.issues.length) statistics.voteNormalizationRejected += 1;
        const identity = population.identities.get(vote.data.deputyExternalId);
        if (!identity) {
          statistics.unmappedDeputies += 1;
          continue;
        }
        resolved.push({ identity, vote });
      }
      if (!resolved.length) continue;
      const persistedVoting = await this.votingPersistence.persist(
        normalizedVoting.data,
      );
      countStatus(statistics, 'votingEvents', persistedVoting.status);
      for (const item of resolved) {
        statistics.elejaVotesResolved += 1;
        const persisted = await this.votePersistence.persist(
          persistedVoting.voting.id,
          item.identity.person.id,
          record.date,
          item.vote.data,
        );
        countStatus(statistics, 'votes', persisted.status);
      }
    }
    return statistics;
  }

  private async loadPopulation(
    electionYear: number,
  ): Promise<{
    peopleConsidered: number;
    identities: Map<string, PersonExternalIdentity>;
    mandates: LegislativeMandate[];
  }> {
    const em = this.orm.em.fork();
    const candidacies = await em.find(
      Candidacy,
      { election: { year: electionYear } },
      { populate: ['person'] },
    );
    const personIds = [...new Set(candidacies.map((item) => item.person.id))];
    const identities = personIds.length
      ? await em.find(
          PersonExternalIdentity,
          {
            source: PersonExternalIdentitySource.CAMARA,
            person: { id: { $in: personIds } },
          },
          { populate: ['person'] },
        )
      : [];
    const linkedPersonIds = identities.map((identity) => identity.person.id);
    const mandates = linkedPersonIds.length
      ? await em.find(LegislativeMandate, {
          body: LegislativeBody.CHAMBER_OF_DEPUTIES,
          person: { id: { $in: linkedPersonIds } },
          startedAt: { $ne: null },
        })
      : [];
    return {
      peopleConsidered: personIds.length,
      identities: new Map(
        identities.map((identity) => [identity.externalId, identity]),
      ),
      mandates,
    };
  }
}

function buildPeriods(
  mandates: readonly LegislativeMandate[],
): CamaraVotingPeriod[] {
  const byYear = new Map<number, { startDate: string; endDate: string }>();
  const today = new Date().toISOString().slice(0, 10);
  for (const mandate of mandates) {
    if (!mandate.startedAt) continue;
    const end = mandate.endedAt ?? today;
    for (
      let year = Number(mandate.startedAt.slice(0, 4));
      year <= Number(end.slice(0, 4));
      year += 1
    ) {
      const startDate =
        year === Number(mandate.startedAt.slice(0, 4))
          ? mandate.startedAt
          : `${year}-01-01`;
      const endDate = year === Number(end.slice(0, 4)) ? end : `${year}-12-31`;
      const current = byYear.get(year);
      byYear.set(year, {
        startDate:
          current && current.startDate < startDate
            ? current.startDate
            : startDate,
        endDate:
          current && current.endDate > endDate ? current.endDate : endDate,
      });
    }
  }
  return [...byYear.values()].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
}

function latestVotesByDeputy(
  records: readonly CamaraDeputyVoteRecord[],
): Map<string, CamaraDeputyVoteRecord> {
  const result = new Map<string, CamaraDeputyVoteRecord>();
  for (const record of records) {
    const key = record.deputyExternalId ?? `invalid:${result.size}`;
    const current = result.get(key);
    if (!current || (record.registeredAt ?? '') >= (current.registeredAt ?? ''))
      result.set(key, record);
  }
  return result;
}

function countStatus(
  stats: CamaraVotingImportStatistics,
  prefix: 'votingEvents' | 'votes',
  status: 'INSERTED' | 'UPDATED' | 'UNCHANGED',
): void {
  const suffix =
    status === 'INSERTED'
      ? 'Inserted'
      : status === 'UPDATED'
        ? 'Updated'
        : 'Unchanged';
  const key = `${prefix}${suffix}` as keyof CamaraVotingImportStatistics;
  stats[key] += 1;
}

function emptyStatistics(
  peopleConsidered: number,
  camaraIdentities: number,
  mandatesConsidered: number,
): CamaraVotingImportStatistics {
  return {
    peopleConsidered,
    camaraIdentities,
    mandatesConsidered,
    votingEventsRead: 0,
    uniqueVotingEvents: 0,
    votingEventsInserted: 0,
    votingEventsUpdated: 0,
    votingEventsUnchanged: 0,
    votingEventsRejected: 0,
    individualVotesRead: 0,
    elejaVotesResolved: 0,
    votesInserted: 0,
    votesUpdated: 0,
    votesUnchanged: 0,
    unmappedDeputies: 0,
    voteNormalizationRejected: 0,
    errors: 0,
  };
}
