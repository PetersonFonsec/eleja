import {
  Person,
  PersonExternalIdentity,
  PersonExternalIdentitySource,
  initializeDatabase,
} from '@eleja/database';
import type { CamaraDeputyRecord } from '../sources/camara/camara-deputy-record.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;

export type DeputyIdentityPersistenceResult =
  | { status: 'INSERTED'; identity: PersonExternalIdentity }
  | { status: 'ALREADY_LINKED'; identity: PersonExternalIdentity }
  | { status: 'IDENTITY_CONFLICT'; externalId: string; ownerPersonId: string };

export class CamaraDeputyIdentityPersistence {
  constructor(private readonly orm: Database) {}

  async persist(
    personId: Person['id'],
    deputy: CamaraDeputyRecord,
    verifiedAt = new Date(),
  ): Promise<DeputyIdentityPersistenceResult> {
    return this.orm.em.transactional(async (em) => {
      const existingForPerson = await em.findOne(PersonExternalIdentity, {
        person: { id: personId },
        source: PersonExternalIdentitySource.CAMARA,
      });
      if (existingForPerson)
        return { status: 'ALREADY_LINKED', identity: existingForPerson };

      const existingOwner = await em.findOne(
        PersonExternalIdentity,
        {
          source: PersonExternalIdentitySource.CAMARA,
          externalId: deputy.externalId,
        },
        { populate: ['person'] },
      );
      if (existingOwner) {
        return {
          status: 'IDENTITY_CONFLICT',
          externalId: deputy.externalId,
          ownerPersonId: existingOwner.person.id,
        };
      }

      const person = await em.findOneOrFail(Person, { id: personId });
      const identity = new PersonExternalIdentity(
        person,
        PersonExternalIdentitySource.CAMARA,
        deputy.externalId,
        { sourceUrl: deputy.profileUrl, verifiedAt },
      );
      em.persist(identity);
      await em.flush();
      return { status: 'INSERTED', identity };
    });
  }
}
