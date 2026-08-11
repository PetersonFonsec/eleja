import {
  LegislativeProposal,
  LegislativeVoting,
  initializeDatabase,
} from '@eleja/database';
import type { NormalizedLegislativeVotingData } from '../normalization/normalized-legislative-voting-data.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;
export type PersistenceStatus = 'INSERTED' | 'UPDATED' | 'UNCHANGED';

export class LegislativeVotingPersistenceService {
  constructor(private readonly orm: Database) {}

  async persist(
    data: NormalizedLegislativeVotingData,
  ): Promise<{ status: PersistenceStatus; voting: LegislativeVoting }> {
    return this.orm.em.transactional(async (em) => {
      const proposal = data.proposalExternalId
        ? await em.findOne(LegislativeProposal, {
            source: data.source,
            externalId: data.proposalExternalId,
          })
        : null;
      const existing = await em.findOne(LegislativeVoting, {
        source: data.source,
        externalId: data.externalId,
      });
      if (!existing) {
        const voting = new LegislativeVoting(
          data.source,
          data.externalId,
          data.dateTime,
          data.sourceUrl,
          {
            description: data.description,
            result: data.result,
            sourceResult: data.sourceResult,
            proposal,
          },
        );
        em.persist(voting);
        await em.flush();
        return { status: 'INSERTED', voting };
      }
      let changed = assign(existing, 'dateTime', data.dateTime);
      changed = assign(existing, 'description', data.description) || changed;
      changed = assign(existing, 'result', data.result) || changed;
      changed = assign(existing, 'sourceResult', data.sourceResult) || changed;
      changed = assign(existing, 'proposal', proposal) || changed;
      changed = assign(existing, 'sourceUrl', data.sourceUrl) || changed;
      if (changed) await em.flush();
      return { status: changed ? 'UPDATED' : 'UNCHANGED', voting: existing };
    });
  }
}

function assign<T extends object, K extends keyof T>(
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
