import {
  LegislativeBody,
  LegislativeMandate,
  LegislativeProposal,
  LegislativeProposalAuthor,
  LegislativeProposalAuthorRole,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import type { CamaraProposalAuthorRecord } from '../sources/camara/camara-proposal-record.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;
type PersistenceEntityManager = Database['em'];

export type LegislativeProposalAuthorshipPersistenceResult =
  | {
      status: 'INSERTED' | 'UPDATED' | 'UNCHANGED';
      authorship: LegislativeProposalAuthor;
    }
  | { status: 'AUTHOR_NOT_MAPPED' };

export class LegislativeProposalAuthorshipPersistenceService {
  constructor(private readonly orm: Database) {}

  async persist(
    proposalId: LegislativeProposal['id'],
    author: CamaraProposalAuthorRecord,
    presentedAt: string | null,
  ): Promise<LegislativeProposalAuthorshipPersistenceResult> {
    if (author.deputyExternalId === null)
      return { status: 'AUTHOR_NOT_MAPPED' };
    return this.orm.em.transactional(async (em) => {
      const identity = await em.findOne(
        PersonExternalIdentity,
        {
          source: PersonExternalIdentitySource.CAMARA,
          externalId: author.deputyExternalId,
        },
        { populate: ['person'] },
      );
      if (!identity) return { status: 'AUTHOR_NOT_MAPPED' };
      const proposal = await em.findOneOrFail(LegislativeProposal, {
        id: proposalId,
      });
      const mandate = await resolveMandate(em, identity.person.id, presentedAt);
      const existing = await em.findOne(LegislativeProposalAuthor, {
        proposal,
        person: identity.person,
      });
      if (!existing) {
        const authorship = new LegislativeProposalAuthor(
          proposal,
          identity.person,
          {
            mandate,
            role: LegislativeProposalAuthorRole.AUTHOR,
            isPrimaryAuthor: author.isPrimaryAuthor,
            sourceAuthorOrder: author.sourceAuthorOrder,
          },
        );
        em.persist(authorship);
        await em.flush();
        return { status: 'INSERTED', authorship };
      }

      let changed = assignIfChanged(existing, 'mandate', mandate);
      changed =
        assignIfChanged(
          existing,
          'role',
          LegislativeProposalAuthorRole.AUTHOR,
        ) || changed;
      changed =
        assignIfChanged(existing, 'isPrimaryAuthor', author.isPrimaryAuthor) ||
        changed;
      changed =
        assignIfChanged(
          existing,
          'sourceAuthorOrder',
          author.sourceAuthorOrder,
        ) || changed;
      if (changed) await em.flush();
      return {
        status: changed ? 'UPDATED' : 'UNCHANGED',
        authorship: existing,
      };
    });
  }
}

async function resolveMandate(
  em: PersistenceEntityManager,
  personId: PersonExternalIdentity['person']['id'],
  presentedAt: string | null,
): Promise<LegislativeMandate | null> {
  if (presentedAt === null) return null;
  const mandates = await em.find(LegislativeMandate, {
    person: { id: personId },
    body: LegislativeBody.CHAMBER_OF_DEPUTIES,
  });
  const matches = mandates.filter(
    (mandate) =>
      mandate.startedAt !== null &&
      mandate.startedAt <= presentedAt &&
      (mandate.endedAt === null || mandate.endedAt >= presentedAt),
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
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
