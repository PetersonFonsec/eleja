import {
  LegislativeMandate,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import type { NormalizedLegislativeMandateData } from '../normalization/normalized-legislative-mandate-data.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;

export type LegislativeMandatePersistenceResult =
  | {
      status: 'INSERTED' | 'UPDATED' | 'UNCHANGED';
      mandateId: LegislativeMandate['id'];
    }
  | {
      status: 'PERSON_IDENTITY_NOT_FOUND';
      personExternalId: string;
    };

export class LegislativeMandatePersistenceService {
  constructor(private readonly orm: Database) {}

  async persist(
    data: NormalizedLegislativeMandateData,
  ): Promise<LegislativeMandatePersistenceResult> {
    return this.orm.em.transactional(async (em) => {
      const identity = await em.findOne(
        PersonExternalIdentity,
        {
          source: PersonExternalIdentitySource.CAMARA,
          externalId: data.personExternalId,
        },
        { populate: ['person'] },
      );
      if (!identity) {
        return {
          status: 'PERSON_IDENTITY_NOT_FOUND',
          personExternalId: data.personExternalId,
        };
      }

      const existing = await em.findOne(LegislativeMandate, {
        person: identity.person,
        body: data.mandate.body,
        legislatureNumber: data.mandate.legislatureNumber,
      });
      if (!existing) {
        const mandate = new LegislativeMandate(
          identity.person,
          data.mandate.body,
          {
            externalMandateId: data.mandate.externalMandateId,
            legislatureNumber: data.mandate.legislatureNumber,
            state: data.mandate.state,
            partyAcronym: data.mandate.partyAcronym,
            startedAt: data.mandate.startedAt,
            endedAt: data.mandate.endedAt,
            status: data.mandate.status,
            sourceStatus: data.mandate.sourceStatus,
          },
        );
        em.persist(mandate);
        await em.flush();
        return { status: 'INSERTED', mandateId: mandate.id };
      }

      let changed = assignIfChanged(
        existing,
        'externalMandateId',
        data.mandate.externalMandateId,
      );
      changed =
        assignIfChanged(existing, 'state', data.mandate.state) || changed;
      changed =
        assignIfChanged(existing, 'partyAcronym', data.mandate.partyAcronym) ||
        changed;
      changed =
        assignIfChanged(existing, 'startedAt', data.mandate.startedAt) ||
        changed;
      changed =
        assignIfChanged(existing, 'endedAt', data.mandate.endedAt) || changed;
      changed =
        assignIfChanged(existing, 'status', data.mandate.status) || changed;
      changed =
        assignIfChanged(existing, 'sourceStatus', data.mandate.sourceStatus) ||
        changed;
      if (changed) await em.flush();
      return {
        status: changed ? 'UPDATED' : 'UNCHANGED',
        mandateId: existing.id,
      };
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
