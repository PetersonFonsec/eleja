import { Collection } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { LegislativeBody } from './legislative-body.js';
import { LegislativeMandateStatus } from './legislative-mandate-status.js';
import { LegislativeProposalAuthor } from './legislative-proposal-author.entity.js';
import { Person } from './person.entity.js';

const UF_PATTERN =
  /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/;

@Entity({ tableName: 'legislative_mandates' })
@Index({
  name: 'legislative_mandates_body_legislature_number_idx',
  properties: ['body', 'legislatureNumber'],
})
@Unique({
  name: 'legislative_mandates_person_body_legislature_unique',
  properties: ['person', 'body', 'legislatureNumber'],
})
export class LegislativeMandate {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @ManyToOne(() => Person, { index: true, deleteRule: 'restrict' })
  readonly person: Person;

  @Enum({ items: () => LegislativeBody })
  readonly body: LegislativeBody;

  @Property({ type: 'string', length: 160, nullable: true })
  externalMandateId: string | null;

  @Property({ type: 'integer', nullable: true })
  legislatureNumber: number | null;

  @Property({ type: 'string', length: 2, nullable: true })
  state: string | null;

  @Property({ type: 'string', length: 30, nullable: true })
  partyAcronym: string | null;

  @Property({ type: 'date', nullable: true })
  startedAt: string | null;

  @Property({ type: 'date', nullable: true })
  endedAt: string | null;

  @Enum({ items: () => LegislativeMandateStatus })
  status: LegislativeMandateStatus;

  @Property({ type: 'string', length: 200, nullable: true })
  sourceStatus: string | null;

  @OneToMany(() => LegislativeProposalAuthor, (author) => author.mandate)
  proposalAuthorships = new Collection<LegislativeProposalAuthor>(this);

  @Property({ type: 'timestamptz' })
  createdAt: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    person: Person,
    body: LegislativeBody,
    options: {
      externalMandateId?: string | null;
      legislatureNumber?: number | null;
      state?: string | null;
      partyAcronym?: string | null;
      startedAt?: string | null;
      endedAt?: string | null;
      status?: LegislativeMandateStatus;
      sourceStatus?: string | null;
      createdAt?: Date;
    } = {},
  ) {
    if (!person) throw new Error('Legislative mandate requires a person');
    if (!Object.values(LegislativeBody).includes(body)) {
      throw new Error('Legislative mandate body is invalid');
    }
    if (options.state != null && !UF_PATTERN.test(options.state)) {
      throw new Error('Legislative mandate state must be a valid UF');
    }
    if (
      options.legislatureNumber != null &&
      (!Number.isSafeInteger(options.legislatureNumber) ||
        options.legislatureNumber <= 0)
    ) {
      throw new Error('Legislature number must be a positive integer');
    }
    if (
      options.startedAt != null &&
      options.endedAt != null &&
      options.endedAt < options.startedAt
    ) {
      throw new Error('Legislative mandate end cannot precede start');
    }
    const status = options.status ?? LegislativeMandateStatus.UNKNOWN;
    if (!Object.values(LegislativeMandateStatus).includes(status)) {
      throw new Error('Legislative mandate status is invalid');
    }

    this.person = person;
    this.body = body;
    this.externalMandateId = options.externalMandateId ?? null;
    this.legislatureNumber = options.legislatureNumber ?? null;
    this.state = options.state ?? null;
    this.partyAcronym = options.partyAcronym ?? null;
    this.startedAt = options.startedAt ?? null;
    this.endedAt = options.endedAt ?? null;
    this.status = status;
    this.sourceStatus = options.sourceStatus ?? null;
    this.createdAt = options.createdAt ?? new Date();
    this.updatedAt = this.createdAt;
  }
}
