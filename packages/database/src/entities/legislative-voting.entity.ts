import { Collection } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { LegislativeProposal } from './legislative-proposal.entity.js';
import { LegislativeSource } from './legislative-source.js';
import { LegislativeVote } from './legislative-vote.entity.js';
import { LegislativeVotingResult } from './legislative-voting-result.js';

@Entity({ tableName: 'legislative_votings' })
@Unique({
  name: 'legislative_votings_source_external_id_unique',
  properties: ['source', 'externalId'],
})
export class LegislativeVoting {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @Enum({ items: () => LegislativeSource })
  readonly source: LegislativeSource;

  @Property({ type: 'string', length: 160 })
  readonly externalId: string;

  // Câmara supplies a local timestamp without an offset. Keep that wall-clock
  // value unchanged instead of interpreting it in the process timezone.
  @Property({
    type: 'datetime',
    columnType: 'timestamp(0) without time zone',
    index: true,
  })
  dateTime: Date;

  @Property({ type: 'text', nullable: true })
  description: string | null;

  @Enum({ items: () => LegislativeVotingResult })
  result: LegislativeVotingResult;

  @Property({ type: 'string', length: 40, nullable: true })
  sourceResult: string | null;

  @ManyToOne(() => LegislativeProposal, {
    nullable: true,
    index: true,
    deleteRule: 'restrict',
  })
  proposal: LegislativeProposal | null;

  @Property({ type: 'text' })
  sourceUrl: string;

  @OneToMany(() => LegislativeVote, (vote) => vote.voting)
  votes = new Collection<LegislativeVote>(this);

  @Property({ type: 'timestamptz' })
  createdAt: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    source: LegislativeSource,
    externalId: string,
    dateTime: Date,
    sourceUrl: string,
    options: {
      description?: string | null;
      result?: LegislativeVotingResult;
      sourceResult?: string | null;
      proposal?: LegislativeProposal | null;
      createdAt?: Date;
    } = {},
  ) {
    if (!Object.values(LegislativeSource).includes(source))
      throw new Error('Legislative voting source is invalid');
    if (!externalId.trim())
      throw new Error('Legislative voting external identifier is required');
    if (Number.isNaN(dateTime.getTime()))
      throw new Error('Legislative voting date/time is invalid');
    if (!sourceUrl.trim())
      throw new Error('Legislative voting source URL is required');
    this.source = source;
    this.externalId = externalId;
    this.dateTime = dateTime;
    this.description = options.description ?? null;
    this.result = options.result ?? LegislativeVotingResult.UNKNOWN;
    this.sourceResult = options.sourceResult ?? null;
    this.proposal = options.proposal ?? null;
    this.sourceUrl = sourceUrl;
    this.createdAt = options.createdAt ?? new Date();
    this.updatedAt = this.createdAt;
  }
}
