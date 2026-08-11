import {
  LegislativeBody,
  LegislativeMandate,
  LegislativeVote,
  LegislativeVoting,
  Person,
  initializeDatabase,
} from '@eleja/database';
import type { NormalizedLegislativeVoteData } from '../normalization/normalized-legislative-voting-data.js';
import type { PersistenceStatus } from './legislative-voting-persistence.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;

export class LegislativeVotePersistenceService {
  constructor(private readonly orm: Database) {}

  async persist(
    votingId: LegislativeVoting['id'],
    personId: Person['id'],
    votingDate: string,
    data: NormalizedLegislativeVoteData,
  ): Promise<{ status: PersistenceStatus; vote: LegislativeVote }> {
    return this.orm.em.transactional(async (em) => {
      const [voting, person] = await Promise.all([
        em.findOneOrFail(LegislativeVoting, { id: votingId }),
        em.findOneOrFail(Person, { id: personId }),
      ]);
      const mandates = await em.find(LegislativeMandate, {
        person,
        body: LegislativeBody.CHAMBER_OF_DEPUTIES,
        startedAt: { $lte: votingDate },
        $or: [{ endedAt: null }, { endedAt: { $gte: votingDate } }],
      });
      const mandate = mandates.length === 1 ? (mandates[0] ?? null) : null;
      const existing = await em.findOne(LegislativeVote, { voting, person });
      if (!existing) {
        const vote = new LegislativeVote(
          voting,
          person,
          data.position,
          data.sourcePosition,
          { mandate, votedAt: data.votedAt },
        );
        em.persist(vote);
        await em.flush();
        return { status: 'INSERTED', vote };
      }
      let changed = set(existing, 'position', data.position);
      changed = set(existing, 'sourcePosition', data.sourcePosition) || changed;
      changed = set(existing, 'votedAt', data.votedAt) || changed;
      changed = set(existing, 'mandate', mandate) || changed;
      if (changed) await em.flush();
      return { status: changed ? 'UPDATED' : 'UNCHANGED', vote: existing };
    });
  }
}

function set<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K],
): boolean {
  const current = target[key];
  if (
    current instanceof Date &&
    value instanceof Date &&
    current.getTime() === value.getTime()
  )
    return false;
  if (
    current === value ||
    (typeof current === 'object' &&
      current !== null &&
      typeof value === 'object' &&
      value !== null &&
      'id' in current &&
      'id' in value &&
      current.id === value.id)
  )
    return false;
  target[key] = value;
  return true;
}
