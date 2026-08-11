import { LegislativeProposal, initializeDatabase } from '@eleja/database';
import type { NormalizedLegislativeProposalData } from '../normalization/normalized-legislative-proposal-data.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;

export interface LegislativeProposalPersistenceResult {
  status: 'INSERTED' | 'UPDATED' | 'UNCHANGED';
  proposal: LegislativeProposal;
}

export class LegislativeProposalPersistenceService {
  constructor(private readonly orm: Database) {}

  async persist(
    data: NormalizedLegislativeProposalData,
  ): Promise<LegislativeProposalPersistenceResult> {
    return this.orm.em.transactional(async (em) => {
      const existing = await em.findOne(LegislativeProposal, {
        source: data.source,
        externalId: data.externalId,
      });
      if (!existing) {
        const proposal = new LegislativeProposal(
          data.source,
          data.externalId,
          data.type,
          {
            number: data.number,
            year: data.year,
            title: data.title,
            summary: data.summary,
            status: data.status,
            sourceStatus: data.sourceStatus,
            url: data.url,
          },
        );
        em.persist(proposal);
        await em.flush();
        return { status: 'INSERTED', proposal };
      }

      let changed = assignIfChanged(existing, 'type', data.type);
      changed = assignIfChanged(existing, 'number', data.number) || changed;
      changed = assignIfChanged(existing, 'year', data.year) || changed;
      changed = assignIfChanged(existing, 'title', data.title) || changed;
      changed = assignIfChanged(existing, 'summary', data.summary) || changed;
      changed = assignIfChanged(existing, 'status', data.status) || changed;
      changed =
        assignIfChanged(existing, 'sourceStatus', data.sourceStatus) || changed;
      changed = assignIfChanged(existing, 'url', data.url) || changed;
      if (changed) await em.flush();
      return { status: changed ? 'UPDATED' : 'UNCHANGED', proposal: existing };
    });
  }
}

function assignIfChanged<
  T extends object,
  K extends {
    [P in keyof T]-?: T[P] extends (...arguments_: never[]) => unknown
      ? never
      : P;
  }[keyof T],
>(entity: T, property: K, value: T[K]): boolean {
  if (entity[property] === value) return false;
  entity[property] = value;
  return true;
}
