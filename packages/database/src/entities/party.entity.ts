import {
  Entity,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';

@Entity({ tableName: 'parties' })
@Unique({
  name: 'parties_name_acronym_number_unique',
  properties: ['name', 'acronym', 'number'],
})
export class Party {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @Property({ type: 'string', length: 100, nullable: true })
  sourcePartyId: string | null;

  @Property({ type: 'string', length: 200 })
  name: string;

  @Property({ type: 'string', length: 30 })
  acronym: string;

  @Property({ type: 'smallint', nullable: true })
  number: number | null;

  @Property({ type: 'timestamptz' })
  createdAt: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    name: string,
    acronym: string,
    number: number | null = null,
    sourcePartyId: string | null = null,
    createdAt = new Date(),
  ) {
    if (name.trim().length === 0) {
      throw new Error('Party name must not be empty');
    }
    if (acronym.trim().length === 0) {
      throw new Error('Party acronym must not be empty');
    }
    if (number !== null && (!Number.isSafeInteger(number) || number <= 0)) {
      throw new Error('Party number must be a positive integer or null');
    }
    if (sourcePartyId !== null && sourcePartyId.trim().length === 0) {
      throw new Error('Party source identifier must not be empty');
    }

    this.name = name;
    this.acronym = acronym;
    this.number = number;
    this.sourcePartyId = sourcePartyId;
    this.createdAt = createdAt;
    this.updatedAt = createdAt;
  }
}
