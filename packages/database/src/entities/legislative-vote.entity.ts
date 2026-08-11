import {
  Entity,
  Enum,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { LegislativeMandate } from './legislative-mandate.entity.js';
import { LegislativeVotePosition } from './legislative-vote-position.js';
import { LegislativeVoting } from './legislative-voting.entity.js';
import { Person } from './person.entity.js';

@Entity({ tableName: 'legislative_votes' })
@Unique({
  name: 'legislative_votes_voting_person_unique',
  properties: ['voting', 'person'],
})
export class LegislativeVote {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @ManyToOne(() => LegislativeVoting, { index: true, deleteRule: 'restrict' })
  readonly voting: LegislativeVoting;

  @ManyToOne(() => Person, { index: true, deleteRule: 'restrict' })
  readonly person: Person;

  @ManyToOne(() => LegislativeMandate, {
    nullable: true,
    index: true,
    deleteRule: 'restrict',
  })
  mandate: LegislativeMandate | null;

  @Enum({ items: () => LegislativeVotePosition })
  position: LegislativeVotePosition;

  @Property({ type: 'string', length: 100 })
  sourcePosition: string;

  @Property({
    type: 'datetime',
    columnType: 'timestamp(0) without time zone',
    nullable: true,
  })
  votedAt: Date | null;

  @Property({ type: 'timestamptz' })
  createdAt: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    voting: LegislativeVoting,
    person: Person,
    position: LegislativeVotePosition,
    sourcePosition: string,
    options: {
      mandate?: LegislativeMandate | null;
      votedAt?: Date | null;
      createdAt?: Date;
    } = {},
  ) {
    if (!voting || !person)
      throw new Error('Legislative vote requires voting and person');
    if (!Object.values(LegislativeVotePosition).includes(position))
      throw new Error('Legislative vote position is invalid');
    if (!sourcePosition.trim())
      throw new Error('Legislative vote source position is required');
    if (options.mandate && options.mandate.person.id !== person.id)
      throw new Error('Legislative vote mandate must belong to its person');
    this.voting = voting;
    this.person = person;
    this.mandate = options.mandate ?? null;
    this.position = position;
    this.sourcePosition = sourcePosition;
    this.votedAt = options.votedAt ?? null;
    this.createdAt = options.createdAt ?? new Date();
    this.updatedAt = this.createdAt;
  }
}
