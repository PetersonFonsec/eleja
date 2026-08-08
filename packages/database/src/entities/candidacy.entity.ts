import { Collection } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { CandidacyStatus } from './candidacy-status.js';
import { CandidateSource } from './candidate-source.entity.js';
import { Election } from './election.entity.js';
import { Office } from './office.entity.js';
import { Party } from './party.entity.js';
import { Person } from './person.entity.js';

@Entity({ tableName: 'candidacies' })
export class Candidacy {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @Property({
    type: 'string',
    length: 100,
    nullable: true,
    unique: true,
  })
  sourceCandidateId: string | null;

  @Property({ type: 'string', length: 200 })
  ballotName: string;

  @Property({ type: 'integer', nullable: true })
  ballotNumber: number | null;

  @Property({ type: 'string', length: 10, nullable: true, index: true })
  state: string | null;

  @Property({ type: 'string', length: 200, nullable: true })
  city: string | null;

  @Property({ type: 'text', nullable: true })
  photoUrl: string | null;

  @Enum({ items: () => CandidacyStatus })
  status: CandidacyStatus;

  @Property({ type: 'string', length: 200, nullable: true })
  sourceStatus: string | null;

  @ManyToOne(() => Person, { index: true, deleteRule: 'restrict' })
  readonly person: Person;

  @ManyToOne(() => Election, { index: true, deleteRule: 'restrict' })
  readonly election: Election;

  @ManyToOne(() => Party, { index: true, deleteRule: 'restrict' })
  readonly party: Party;

  @ManyToOne(() => Office, { index: true, deleteRule: 'restrict' })
  readonly office: Office;

  @OneToMany(() => CandidateSource, (source) => source.candidacy)
  sources = new Collection<CandidateSource>(this);

  @Property({ type: 'timestamptz' })
  createdAt: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    person: Person,
    election: Election,
    party: Party,
    office: Office,
    ballotName: string,
    options: {
      sourceCandidateId?: string | null;
      ballotNumber?: number | null;
      state?: string | null;
      city?: string | null;
      photoUrl?: string | null;
      status?: CandidacyStatus;
      sourceStatus?: string | null;
      createdAt?: Date;
    } = {},
  ) {
    if (!person || !election || !party || !office) {
      throw new Error('Candidacy requires person, election, party, and office');
    }
    if (ballotName.trim().length === 0) {
      throw new Error('Candidacy ballot name must not be empty');
    }
    if (
      options.ballotNumber != null &&
      (!Number.isSafeInteger(options.ballotNumber) || options.ballotNumber <= 0)
    ) {
      throw new Error(
        'Candidacy ballot number must be a positive integer or null',
      );
    }

    const status = options.status ?? CandidacyStatus.UNKNOWN;
    if (!Object.values(CandidacyStatus).includes(status)) {
      throw new Error('Candidacy status is invalid');
    }
    if (
      options.sourceCandidateId != null &&
      options.sourceCandidateId.trim().length === 0
    ) {
      throw new Error('Candidacy source identifier must not be empty');
    }

    this.person = person;
    this.election = election;
    this.party = party;
    this.office = office;
    this.ballotName = ballotName;
    this.sourceCandidateId = options.sourceCandidateId ?? null;
    this.ballotNumber = options.ballotNumber ?? null;
    this.state = options.state ?? null;
    this.city = options.city ?? null;
    this.photoUrl = options.photoUrl ?? null;
    this.status = status;
    this.sourceStatus = options.sourceStatus ?? null;
    this.createdAt = options.createdAt ?? new Date();
    this.updatedAt = this.createdAt;
  }
}
