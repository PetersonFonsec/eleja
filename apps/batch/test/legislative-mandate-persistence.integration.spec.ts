import {
  LegislativeBody,
  LegislativeMandate,
  LegislativeMandateStatus,
  Person,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NormalizedLegislativeMandateData } from '../src/normalization/normalized-legislative-mandate-data.js';
import { LegislativeMandatePersistenceService } from '../src/persistence/legislative-mandate-persistence.js';

describe('LegislativeMandatePersistenceService', () => {
  let orm: Awaited<ReturnType<typeof initializeDatabase>>;

  beforeAll(async () => {
    orm = await initializeDatabase();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('persists, reloads and reuses a mandate idempotently', async () => {
    const context = await createPersonWithIdentity();
    const persistence = new LegislativeMandatePersistenceService(orm);
    try {
      const first = await persistence.persist(
        normalized(context.externalId, 57),
      );
      const second = await persistence.persist(
        normalized(context.externalId, 57),
      );
      expect(first.status).toBe('INSERTED');
      expect(second.status).toBe('UNCHANGED');

      const em = orm.em.fork();
      const mandates = await em.find(
        LegislativeMandate,
        { person: context.person.id },
        { populate: ['person'] },
      );
      expect(mandates).toHaveLength(1);
      expect(mandates[0]).toMatchObject({
        legislatureNumber: 57,
        state: 'SP',
        status: LegislativeMandateStatus.ACTIVE,
      });
      expect(mandates[0]?.person.id).toBe(context.person.id);
    } finally {
      await cleanup(context);
    }
  });

  it('updates the same logical mandate after an official correction', async () => {
    const context = await createPersonWithIdentity();
    const persistence = new LegislativeMandatePersistenceService(orm);
    try {
      const inserted = await persistence.persist(
        normalized(context.externalId, 57),
      );
      const updated = await persistence.persist(
        normalized(context.externalId, 57, {
          endedAt: '2025-01-01',
          status: LegislativeMandateStatus.COMPLETED,
          sourceStatus: 'Vacância',
          partyAcronym: 'XYZ',
        }),
      );
      expect(updated.status).toBe('UPDATED');
      if (inserted.status !== 'INSERTED' || updated.status !== 'UPDATED') {
        throw new Error('Expected mandate insert followed by update');
      }
      expect(updated.mandateId).toBe(inserted.mandateId);
      const mandate = await orm.em.fork().findOneOrFail(LegislativeMandate, {
        person: context.person.id,
        legislatureNumber: 57,
      });
      expect(mandate).toMatchObject({
        endedAt: '2025-01-01',
        status: LegislativeMandateStatus.COMPLETED,
        sourceStatus: 'Vacância',
        partyAcronym: 'XYZ',
      });
    } finally {
      await cleanup(context);
    }
  });

  it('keeps different legislatures and people as separate mandates', async () => {
    const first = await createPersonWithIdentity();
    const second = await createPersonWithIdentity();
    const persistence = new LegislativeMandatePersistenceService(orm);
    try {
      await persistence.persist(normalized(first.externalId, 56));
      await persistence.persist(normalized(first.externalId, 57));
      await persistence.persist(normalized(second.externalId, 57));
      expect(
        await orm.em.fork().count(LegislativeMandate, {
          person: first.person.id,
        }),
      ).toBe(2);
      expect(
        await orm.em.fork().count(LegislativeMandate, {}),
      ).toBeGreaterThanOrEqual(3);
    } finally {
      await cleanup(first);
      await cleanup(second);
    }
  });

  it('does not create a person when the Câmara identity is missing', async () => {
    const result = await new LegislativeMandatePersistenceService(orm).persist(
      normalized(`missing-${randomUUID()}`, 57),
    );
    expect(result.status).toBe('PERSON_IDENTITY_NOT_FOUND');
  });

  async function createPersonWithIdentity() {
    const person = new Person(`Pessoa mandato ${randomUUID()}`);
    const externalId = String(Math.floor(Math.random() * 1_000_000_000));
    const identity = new PersonExternalIdentity(
      person,
      PersonExternalIdentitySource.CAMARA,
      externalId,
      { verifiedAt: new Date() },
    );
    const em = orm.em.fork();
    em.persist([person, identity]);
    await em.flush();
    return { person, identity, externalId };
  }

  async function cleanup(
    context: Awaited<ReturnType<typeof createPersonWithIdentity>>,
  ) {
    const em = orm.em.fork();
    await em.nativeDelete(LegislativeMandate, { person: context.person.id });
    await em.nativeDelete(PersonExternalIdentity, context.identity.id);
    await em.nativeDelete(Person, context.person.id);
  }
});

function normalized(
  personExternalId: string,
  legislatureNumber: number,
  overrides: Partial<NormalizedLegislativeMandateData['mandate']> = {},
): NormalizedLegislativeMandateData {
  return {
    personExternalId,
    mandate: {
      body: LegislativeBody.CHAMBER_OF_DEPUTIES,
      externalMandateId: null,
      legislatureNumber,
      state: 'SP',
      partyAcronym: 'ABC',
      startedAt: legislatureNumber === 56 ? '2019-02-01' : '2023-02-01',
      endedAt: null,
      status: LegislativeMandateStatus.ACTIVE,
      sourceStatus: 'Exercício',
      ...overrides,
    },
  };
}
