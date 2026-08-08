import { Collection } from '@mikro-orm/core';
import {
  Entity,
  Index,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { Candidacy } from './candidacy.entity.js';

@Entity({ tableName: 'people' })
@Index({
  name: 'people_name_birth_date_idx',
  properties: ['name', 'birthDate'],
})
export class Person {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @Property({ type: 'string', length: 200 })
  name: string;

  @Property({ type: 'date', nullable: true })
  birthDate: string | null;

  @Property({ type: 'string', length: 100, nullable: true })
  gender: string | null;

  @Property({ type: 'string', length: 200, nullable: true })
  education: string | null;

  @Property({ type: 'string', length: 200, nullable: true })
  occupation: string | null;

  @OneToMany(() => Candidacy, (candidacy) => candidacy.person)
  candidacies = new Collection<Candidacy>(this);

  @Property({ type: 'timestamptz' })
  createdAt: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    name: string,
    birthDate: string | null = null,
    gender: string | null = null,
    education: string | null = null,
    occupation: string | null = null,
    createdAt = new Date(),
  ) {
    if (name.trim().length === 0) {
      throw new Error('Person name must not be empty');
    }
    if (birthDate !== null) {
      const parsedBirthDate = new Date(`${birthDate}T00:00:00.000Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
        Number.isNaN(parsedBirthDate.getTime()) ||
        parsedBirthDate.toISOString().slice(0, 10) !== birthDate
      ) {
        throw new Error('Person birth date must use a valid YYYY-MM-DD date');
      }
      if (birthDate > createdAt.toISOString().slice(0, 10)) {
        throw new Error('Person birth date cannot be in the future');
      }
    }

    this.name = name;
    this.birthDate = birthDate;
    this.gender = gender;
    this.education = education;
    this.occupation = occupation;
    this.createdAt = createdAt;
    this.updatedAt = createdAt;
  }
}
