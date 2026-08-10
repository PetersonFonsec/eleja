import {
  Entity,
  Enum,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { PersonExternalIdentitySource } from './person-external-identity-source.js';
import { Person } from './person.entity.js';

@Entity({ tableName: 'person_external_identities' })
@Unique({
  name: 'person_external_identities_source_external_id_unique',
  properties: ['source', 'externalId'],
})
export class PersonExternalIdentity {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @ManyToOne(() => Person, { index: true, deleteRule: 'restrict' })
  readonly person: Person;

  @Enum({ items: () => PersonExternalIdentitySource })
  readonly source: PersonExternalIdentitySource;

  @Property({ type: 'string', length: 160 })
  readonly externalId: string;

  @Property({ type: 'text', nullable: true })
  sourceUrl: string | null;

  @Property({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Property({ type: 'timestamptz' })
  createdAt: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    person: Person,
    source: PersonExternalIdentitySource,
    externalId: string,
    options: {
      sourceUrl?: string | null;
      verifiedAt?: Date | null;
      createdAt?: Date;
    } = {},
  ) {
    if (!person) throw new Error('External identity requires a person');
    if (!Object.values(PersonExternalIdentitySource).includes(source)) {
      throw new Error('External identity source is invalid');
    }
    if (!externalId.trim()) {
      throw new Error('External identity identifier must not be empty');
    }

    this.person = person;
    this.source = source;
    this.externalId = externalId;
    this.sourceUrl = options.sourceUrl ?? null;
    this.verifiedAt = options.verifiedAt ?? null;
    this.createdAt = options.createdAt ?? new Date();
    this.updatedAt = this.createdAt;
  }
}
