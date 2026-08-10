import {
  Person,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CamaraDeputyIdentityPersistence } from '../src/persistence/camara-deputy-identity-persistence.js';
import type { CamaraDeputyRecord } from '../src/sources/camara/camara-deputy-record.js';

describe('Câmara deputy identity persistence', () => {
  let orm: Awaited<ReturnType<typeof initializeDatabase>>;

  beforeAll(async () => {
    orm = await initializeDatabase();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('persists, reloads and reuses the same identity idempotently', async () => {
    const person = new Person(`Pessoa Câmara ${randomUUID()}`, '1980-01-15');
    const externalId = randomUUID();
    const verifiedAt = new Date('2026-08-10T12:00:00.000Z');
    const persistence = new CamaraDeputyIdentityPersistence(orm);
    const setup = orm.em.fork();
    setup.persist(person);
    await setup.flush();

    try {
      const first = await persistence.persist(
        person.id,
        deputy(externalId),
        verifiedAt,
      );
      const second = await persistence.persist(
        person.id,
        deputy(externalId),
        verifiedAt,
      );
      expect(first.status).toBe('INSERTED');
      expect(second.status).toBe('ALREADY_LINKED');

      const em = orm.em.fork();
      const identities = await em.find(
        PersonExternalIdentity,
        { person: person.id, source: PersonExternalIdentitySource.CAMARA },
        { populate: ['person'] },
      );
      expect(identities).toHaveLength(1);
      expect(identities[0]).toMatchObject({
        externalId,
        source: PersonExternalIdentitySource.CAMARA,
        verifiedAt,
      });
      expect(identities[0]?.person.id).toBe(person.id);
    } finally {
      const cleanup = orm.em.fork();
      await cleanup.nativeDelete(PersonExternalIdentity, { person: person.id });
      await cleanup.nativeDelete(Person, person.id);
    }
  });

  it('reports a conflict instead of reassigning an external ID', async () => {
    const owner = new Person(`Pessoa proprietária ${randomUUID()}`);
    const other = new Person(`Outra pessoa ${randomUUID()}`);
    const externalId = randomUUID();
    const persistence = new CamaraDeputyIdentityPersistence(orm);
    const setup = orm.em.fork();
    setup.persist([owner, other]);
    await setup.flush();

    try {
      await persistence.persist(owner.id, deputy(externalId));
      const result = await persistence.persist(other.id, deputy(externalId));
      expect(result).toEqual({
        status: 'IDENTITY_CONFLICT',
        externalId,
        ownerPersonId: owner.id,
      });
      expect(
        await orm.em.fork().count(PersonExternalIdentity, { externalId }),
      ).toBe(1);
    } finally {
      const cleanup = orm.em.fork();
      await cleanup.nativeDelete(PersonExternalIdentity, { externalId });
      await cleanup.nativeDelete(Person, { id: { $in: [owner.id, other.id] } });
    }
  });
});

function deputy(externalId: string): CamaraDeputyRecord {
  return {
    externalId,
    name: 'Pessoa Câmara',
    parliamentaryName: 'Pessoa',
    state: 'SP',
    partyAcronym: 'ABC',
    birthDate: '1980-01-15',
    photoUrl: null,
    profileUrl: `https://dadosabertos.camara.leg.br/api/v2/deputados/${externalId}`,
  };
}
