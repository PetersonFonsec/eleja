import {
  CandidateSource,
  Candidacy,
  Election,
  Office,
  Party,
  Person,
  initializeDatabase,
} from '@eleja/database';
import type { NormalizedCandidateData } from '../normalization/normalized-candidate-data.js';
import type { CandidateImportContext } from './candidate-import-context.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;
type PersistenceEntityManager = Database['em'];
type EntityId = Election['id'];

export interface CandidatePersistenceIssue {
  sourceCandidateId: string;
  field: 'election' | 'party' | 'office' | 'person' | 'candidacy' | 'source';
  reason: string;
}

export interface CandidatePersistenceCreated {
  election: boolean;
  party: boolean;
  office: boolean;
  person: boolean;
  candidacy: boolean;
}

export type CandidatePersistenceResult =
  | {
      status: 'INSERTED' | 'UPDATED' | 'UNCHANGED';
      person: Person;
      candidacy: Candidacy;
      source: CandidateSource;
      sourceStatus: 'INSERTED' | 'UPDATED' | 'UNCHANGED';
      created: CandidatePersistenceCreated;
    }
  | { status: 'REJECTED'; issue: CandidatePersistenceIssue };

interface ResolvedEntity<T> {
  entity: T;
  created: boolean;
  cacheKey?: string;
}

interface TransactionResult {
  result: Exclude<CandidatePersistenceResult, { status: 'REJECTED' }>;
  cacheEntries: Array<{
    cache: Map<string, EntityId>;
    key: string;
    id: EntityId;
  }>;
}

export class CandidatePersistenceService {
  private readonly electionIds = new Map<string, EntityId>();
  private readonly partyIds = new Map<string, EntityId>();
  private readonly officeIds = new Map<string, EntityId>();
  private readonly partyIdentities = new Map<
    string,
    Pick<
      NormalizedCandidateData['party'],
      'sourcePartyId' | 'number' | 'acronym'
    >
  >();
  private readonly officeIdentities = new Map<
    string,
    Pick<NormalizedCandidateData['office'], 'sourceCode' | 'scope'>
  >();

  constructor(
    private readonly orm: Database,
    private readonly defaultContext?: CandidateImportContext,
  ) {}

  async persist(
    data: NormalizedCandidateData,
    context = this.defaultContext,
  ): Promise<CandidatePersistenceResult> {
    if (!context) {
      throw new Error('Candidate import context is required');
    }
    try {
      const transaction = await this.orm.em.transactional(async (em) =>
        this.persistInTransaction(em, data, context),
      );
      for (const entry of transaction.cacheEntries) {
        entry.cache.set(entry.key, entry.id);
      }
      if (transaction.result.status === 'INSERTED') {
        this.partyIdentities.set(partyKey(data), {
          sourcePartyId: data.party.sourcePartyId,
          number: data.party.number,
          acronym: data.party.acronym,
        });
        this.officeIdentities.set(data.office.code, {
          sourceCode: data.office.sourceCode,
          scope: data.office.scope,
        });
      }
      return transaction.result;
    } catch (error: unknown) {
      if (error instanceof CandidatePersistenceConflict) {
        return { status: 'REJECTED', issue: error.issue };
      }
      throw error;
    }
  }

  clearCaches(): void {
    this.electionIds.clear();
    this.partyIds.clear();
    this.officeIds.clear();
    this.partyIdentities.clear();
    this.officeIdentities.clear();
  }

  private async persistInTransaction(
    em: PersistenceEntityManager,
    data: NormalizedCandidateData,
    context: CandidateImportContext,
  ): Promise<TransactionResult> {
    const existingCandidacy = await em.findOne(
      Candidacy,
      { sourceCandidateId: data.candidacy.sourceCandidateId },
      { populate: ['person', 'election', 'party', 'office'] },
    );
    if (existingCandidacy) {
      const result = this.updateExistingCandidacy(existingCandidacy, data);
      const source = await this.persistSource(
        em,
        existingCandidacy,
        data,
        context,
      );
      return {
        result: {
          ...result,
          source: source.entity,
          sourceStatus: source.status,
        },
        cacheEntries: [],
      };
    }

    const election = await this.resolveElection(em, data);
    const party = await this.resolveParty(em, data);
    const office = await this.resolveOffice(em, data);
    const person = await this.resolvePerson(em, data);
    const candidacy = new Candidacy(
      person.entity,
      election.entity,
      party.entity,
      office.entity,
      data.candidacy.ballotName,
      {
        sourceCandidateId: data.candidacy.sourceCandidateId,
        ballotNumber: data.candidacy.ballotNumber,
        state: data.candidacy.state,
        city: data.candidacy.city,
        photoUrl: data.candidacy.photoUrl,
        status: data.candidacy.status,
        sourceStatus: data.candidacy.sourceStatus,
      },
    );
    em.persist(candidacy);
    const source = await this.persistSource(em, candidacy, data, context);

    const created = {
      election: election.created,
      party: party.created,
      office: office.created,
      person: person.created,
      candidacy: true,
    };
    return {
      result: {
        status: 'INSERTED',
        person: person.entity,
        candidacy,
        source: source.entity,
        sourceStatus: source.status,
        created,
      },
      cacheEntries: [
        cacheEntry(this.electionIds, election),
        cacheEntry(this.partyIds, party),
        cacheEntry(this.officeIds, office),
      ].filter((entry) => entry !== undefined),
    };
  }

  private updateExistingCandidacy(
    candidacy: Candidacy,
    data: NormalizedCandidateData,
  ): Omit<
    Exclude<CandidatePersistenceResult, { status: 'REJECTED' }>,
    'source' | 'sourceStatus'
  > {
    assertExistingIdentity(candidacy, data);
    let changed = updatePerson(candidacy.person, data);
    changed =
      assignIfChanged(candidacy, 'ballotName', data.candidacy.ballotName) ||
      changed;
    changed =
      assignIfChanged(candidacy, 'ballotNumber', data.candidacy.ballotNumber) ||
      changed;
    changed =
      assignIfChanged(candidacy, 'state', data.candidacy.state) || changed;
    changed =
      assignIfChanged(candidacy, 'city', data.candidacy.city) || changed;
    changed =
      assignIfChanged(candidacy, 'photoUrl', data.candidacy.photoUrl) ||
      changed;
    changed =
      assignIfChanged(candidacy, 'status', data.candidacy.status) || changed;
    changed =
      assignIfChanged(candidacy, 'sourceStatus', data.candidacy.sourceStatus) ||
      changed;

    return {
      status: changed ? 'UPDATED' : 'UNCHANGED',
      person: candidacy.person,
      candidacy,
      created: emptyCreated(),
    };
  }

  private async persistSource(
    em: PersistenceEntityManager,
    candidacy: Candidacy,
    data: NormalizedCandidateData,
    context: CandidateImportContext,
  ): Promise<{
    entity: CandidateSource;
    status: 'INSERTED' | 'UPDATED' | 'UNCHANGED';
  }> {
    const identity = {
      candidacy,
      type: context.sourceType,
      rawChecksum: context.rawChecksum.toLowerCase(),
      sourceIdentifier: data.candidacy.sourceCandidateId,
    };
    const existing = await em.findOne(CandidateSource, identity);
    if (!existing) {
      const entity = new CandidateSource(
        candidacy,
        context.sourceType,
        context.sourceName,
        data.candidacy.sourceCandidateId,
        context.rawStorageKey,
        context.rawChecksum,
        {
          sourceUrl: context.sourceUrl,
          importedAt: context.importedAt,
          lastCheckedAt: context.importedAt,
        },
      );
      em.persist(entity);
      return { entity, status: 'INSERTED' };
    }
    if (existing.rawStorageKey !== context.rawStorageKey) {
      conflict(data, 'source', 'source observation storage key conflict');
    }

    let changed = assignIfChanged(existing, 'name', context.sourceName);
    changed =
      assignIfChanged(existing, 'sourceUrl', context.sourceUrl) || changed;
    if (context.importedAt > existing.lastCheckedAt) {
      existing.lastCheckedAt = context.importedAt;
      changed = true;
    }
    return { entity: existing, status: changed ? 'UPDATED' : 'UNCHANGED' };
  }

  private async resolveElection(
    em: PersistenceEntityManager,
    data: NormalizedCandidateData,
  ): Promise<ResolvedEntity<Election>> {
    const key = electionKey(data);
    const cachedId = this.electionIds.get(key);
    if (cachedId) {
      return {
        entity: em.getReference(Election, cachedId),
        created: false,
        cacheKey: key,
      };
    }
    let entity = await em.findOne(Election, data.election);
    const created = !entity;
    if (!entity) {
      entity = new Election(
        data.election.year,
        data.election.type,
        data.election.round,
      );
      em.persist(entity);
    }
    return { entity, created, cacheKey: key };
  }

  private async resolveParty(
    em: PersistenceEntityManager,
    data: NormalizedCandidateData,
  ): Promise<ResolvedEntity<Party>> {
    const key = partyKey(data);
    const cachedId = this.partyIds.get(key);
    if (cachedId) {
      const identity = this.partyIdentities.get(key);
      if (
        !identity ||
        identity.sourcePartyId !== data.party.sourcePartyId ||
        identity.number !== data.party.number ||
        identity.acronym !== data.party.acronym
      ) {
        conflict(data, 'party', 'party identity conflict');
      }
      const entity = em.getReference(Party, cachedId);
      entity.sourcePartyId = data.party.sourcePartyId;
      entity.number = data.party.number;
      entity.acronym = data.party.acronym;
      entity.name = data.party.name;
      return { entity, created: false, cacheKey: key };
    }

    let entity = data.party.sourcePartyId
      ? await em.findOne(Party, { sourcePartyId: data.party.sourcePartyId })
      : null;
    entity ??= await em.findOne(Party, {
      $or: [
        ...(data.party.number !== null ? [{ number: data.party.number }] : []),
        { acronym: data.party.acronym },
      ],
    });
    const created = !entity;
    if (!entity) {
      entity = new Party(
        data.party.name,
        data.party.acronym,
        data.party.number,
        data.party.sourcePartyId,
      );
      em.persist(entity);
    } else {
      assertPartyIdentity(entity, data);
      if (entity.sourcePartyId === null && data.party.sourcePartyId !== null) {
        entity.sourcePartyId = data.party.sourcePartyId;
      }
      entity.name = data.party.name;
    }
    return { entity, created, cacheKey: key };
  }

  private async resolveOffice(
    em: PersistenceEntityManager,
    data: NormalizedCandidateData,
  ): Promise<ResolvedEntity<Office>> {
    const key = data.office.code;
    const cachedId = this.officeIds.get(key);
    if (cachedId) {
      const identity = this.officeIdentities.get(key);
      if (
        !identity ||
        identity.sourceCode !== data.office.sourceCode ||
        identity.scope !== data.office.scope
      ) {
        conflict(data, 'office', 'canonical office identity conflict');
      }
      const entity = em.getReference(Office, cachedId);
      entity.sourceCode = data.office.sourceCode;
      entity.code = data.office.code;
      entity.name = data.office.name;
      entity.scope = data.office.scope;
      return { entity, created: false, cacheKey: key };
    }
    let entity = await em.findOne(Office, { code: data.office.code });
    const created = !entity;
    if (!entity) {
      entity = new Office(
        data.office.code,
        data.office.name,
        data.office.scope,
        data.office.sourceCode,
      );
      em.persist(entity);
    } else {
      if (
        entity.scope !== data.office.scope ||
        entity.sourceCode !== data.office.sourceCode
      ) {
        conflict(data, 'office', 'canonical office identity conflict');
      }
      entity.name = data.office.name;
    }
    return { entity, created, cacheKey: key };
  }

  private async resolvePerson(
    em: PersistenceEntityManager,
    data: NormalizedCandidateData,
  ): Promise<ResolvedEntity<Person>> {
    const key = personKey(data);
    if (key) {
      const matches = await em.find(
        Person,
        {
          name: data.person.name,
          birthDate: data.person.birthDate,
        },
        { populate: ['candidacies.election'] },
      );
      const eligible = matches.filter(
        (person) =>
          gendersAreCompatible(person, data) &&
          !person.candidacies
            .getItems()
            .some(
              (candidacy) =>
                candidacy.election.year === data.election.year &&
                candidacy.election.type === data.election.type &&
                candidacy.election.round === data.election.round,
            ),
      );
      if (eligible.length === 1) {
        updatePerson(eligible[0]!, data);
        return { entity: eligible[0]!, created: false };
      }
    }

    const entity = new Person(
      data.person.name,
      data.person.birthDate,
      data.person.gender,
      data.person.education,
      data.person.occupation,
    );
    em.persist(entity);
    return { entity, created: true };
  }
}

class CandidatePersistenceConflict extends Error {
  constructor(readonly issue: CandidatePersistenceIssue) {
    super(issue.reason);
  }
}

function assertExistingIdentity(
  candidacy: Candidacy,
  data: NormalizedCandidateData,
): void {
  if (
    candidacy.election.year !== data.election.year ||
    candidacy.election.type !== data.election.type ||
    candidacy.election.round !== data.election.round
  ) {
    conflict(
      data,
      'election',
      'existing candidacy belongs to a different election',
    );
  }
  if (candidacy.office.code !== data.office.code) {
    conflict(
      data,
      'office',
      'existing candidacy belongs to a different office',
    );
  }
  if (!partyMatches(candidacy.party, data)) {
    conflict(data, 'party', 'existing candidacy belongs to a different party');
  }
  if (
    candidacy.person.name !== data.person.name ||
    candidacy.person.birthDate !== data.person.birthDate ||
    !gendersAreCompatible(candidacy.person, data)
  ) {
    conflict(
      data,
      'person',
      'existing candidacy resolves to a different person',
    );
  }
}

function assertPartyIdentity(
  party: Party,
  data: NormalizedCandidateData,
): void {
  if (!partyMatches(party, data)) {
    conflict(data, 'party', 'party identity conflict');
  }
}

function partyMatches(party: Party, data: NormalizedCandidateData): boolean {
  return (
    (party.sourcePartyId === null ||
      data.party.sourcePartyId === null ||
      party.sourcePartyId === data.party.sourcePartyId) &&
    (party.number === null ||
      data.party.number === null ||
      party.number === data.party.number) &&
    party.acronym === data.party.acronym
  );
}

function updatePerson(person: Person, data: NormalizedCandidateData): boolean {
  let changed = assignIfChanged(person, 'gender', data.person.gender);
  changed =
    assignIfChanged(person, 'education', data.person.education) || changed;
  changed =
    assignIfChanged(person, 'occupation', data.person.occupation) || changed;
  return changed;
}

function gendersAreCompatible(
  person: Person,
  data: NormalizedCandidateData,
): boolean {
  return (
    person.gender === null ||
    data.person.gender === null ||
    person.gender === data.person.gender
  );
}

function assignIfChanged<T extends object, K extends keyof T>(
  entity: T,
  property: K,
  value: T[K],
): boolean {
  if (entity[property] === value) return false;
  entity[property] = value;
  return true;
}

function electionKey(data: NormalizedCandidateData): string {
  return `${data.election.year}|${data.election.type}|${data.election.round ?? 'null'}`;
}

function partyKey(data: NormalizedCandidateData): string {
  return data.party.sourcePartyId
    ? `source:${data.party.sourcePartyId}`
    : `fallback:${data.party.number ?? 'null'}|${data.party.acronym}`;
}

function personKey(data: NormalizedCandidateData): string | undefined {
  return data.person.birthDate
    ? `${data.person.name}|${data.person.birthDate}|${data.person.gender ?? 'null'}`
    : undefined;
}

function cacheEntry<T extends { id: EntityId }>(
  cache: Map<string, EntityId>,
  resolved: ResolvedEntity<T>,
): { cache: Map<string, EntityId>; key: string; id: EntityId } | undefined {
  return resolved.cacheKey
    ? { cache, key: resolved.cacheKey, id: resolved.entity.id }
    : undefined;
}

function emptyCreated(): CandidatePersistenceCreated {
  return {
    election: false,
    party: false,
    office: false,
    person: false,
    candidacy: false,
  };
}

function conflict(
  data: NormalizedCandidateData,
  field: CandidatePersistenceIssue['field'],
  reason: string,
): never {
  throw new CandidatePersistenceConflict({
    sourceCandidateId: data.candidacy.sourceCandidateId,
    field,
    reason,
  });
}
