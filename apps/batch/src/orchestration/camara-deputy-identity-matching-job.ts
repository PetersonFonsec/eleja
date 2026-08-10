import {
  Candidacy,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import {
  CamaraDeputyIdentityMatcher,
  type DeputyMatchPerson,
} from '../identity/camara-deputy-identity-matcher.js';
import { CamaraDeputyIdentityPersistence } from '../persistence/camara-deputy-identity-persistence.js';
import { CamaraDeputySource } from '../sources/camara/camara-deputy-source.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;

export interface CamaraDeputyMatchingStatistics {
  deputyRecordsLoaded: number;
  peopleConsidered: number;
  alreadyLinked: number;
  matched: number;
  ambiguous: number;
  notFound: number;
  conflicts: number;
  errors: number;
}

export class CamaraDeputyIdentityMatchingJob {
  constructor(
    private readonly orm: Database,
    private readonly source: CamaraDeputySource,
    private readonly persistence = new CamaraDeputyIdentityPersistence(orm),
  ) {}

  async execute(
    electionYear: number,
    sourceInterval: { startDate: string; endDate: string },
  ): Promise<CamaraDeputyMatchingStatistics> {
    if (
      !Number.isSafeInteger(electionYear) ||
      electionYear < 1900 ||
      electionYear > 9999
    ) {
      throw new Error('Election year must be an integer between 1900 and 9999');
    }
    const people = await this.loadPeople(electionYear);
    const em = this.orm.em.fork();
    const identities = people.length
      ? await em.find(PersonExternalIdentity, {
          source: PersonExternalIdentitySource.CAMARA,
          person: { id: { $in: people.map((person) => person.id) } },
        })
      : [];
    const linkedPersonIds = new Set(
      identities.map((identity) => identity.person.id),
    );
    const unlinkedPeople = people.filter(
      (person) => !linkedPersonIds.has(person.id),
    );
    const deputies = unlinkedPeople.length
      ? await this.source.fetchAll(sourceInterval)
      : [];
    const matcher = new CamaraDeputyIdentityMatcher(deputies);
    const statistics: CamaraDeputyMatchingStatistics = {
      deputyRecordsLoaded: deputies.length,
      peopleConsidered: people.length,
      alreadyLinked: linkedPersonIds.size,
      matched: 0,
      ambiguous: 0,
      notFound: 0,
      conflicts: 0,
      errors: 0,
    };

    for (const person of unlinkedPeople) {
      const result = matcher.match(person);
      if (result.status === 'AMBIGUOUS') {
        statistics.ambiguous += 1;
        continue;
      }
      if (result.status === 'NOT_FOUND') {
        statistics.notFound += 1;
        continue;
      }
      try {
        const persisted = await this.persistence.persist(
          person.id,
          result.deputy,
        );
        if (persisted.status === 'INSERTED') statistics.matched += 1;
        if (persisted.status === 'ALREADY_LINKED')
          statistics.alreadyLinked += 1;
        if (persisted.status === 'IDENTITY_CONFLICT') statistics.conflicts += 1;
      } catch {
        statistics.errors += 1;
      }
    }
    return statistics;
  }

  private async loadPeople(electionYear: number): Promise<DeputyMatchPerson[]> {
    const candidacies = await this.orm.em
      .fork()
      .find(
        Candidacy,
        { election: { year: electionYear } },
        { populate: ['person', 'party'] },
      );
    const people = new Map<string, DeputyMatchPerson>();
    for (const candidacy of candidacies) {
      const existing = people.get(candidacy.person.id);
      if (existing) {
        (existing.states as string[]).push(...optional(candidacy.state));
        (existing.ballotNames as string[]).push(candidacy.ballotName);
        (existing.partyAcronyms as string[]).push(candidacy.party.acronym);
      } else {
        people.set(candidacy.person.id, {
          id: candidacy.person.id,
          name: candidacy.person.name,
          birthDate: candidacy.person.birthDate,
          states: optional(candidacy.state),
          ballotNames: [candidacy.ballotName],
          partyAcronyms: [candidacy.party.acronym],
        });
      }
    }
    return [...people.values()];
  }
}

function optional(value: string | null): string[] {
  return value === null ? [] : [value];
}
