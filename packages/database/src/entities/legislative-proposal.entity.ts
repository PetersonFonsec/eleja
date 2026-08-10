import { Collection } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  Index,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { LegislativeProposalAuthor } from './legislative-proposal-author.entity.js';
import { LegislativeSource } from './legislative-source.js';

@Entity({ tableName: 'legislative_proposals' })
@Unique({
  name: 'legislative_proposals_source_external_id_unique',
  properties: ['source', 'externalId'],
})
@Index({
  name: 'legislative_proposals_type_year_idx',
  properties: ['type', 'year'],
})
export class LegislativeProposal {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @Enum({ items: () => LegislativeSource })
  readonly source: LegislativeSource;

  @Property({ type: 'string', length: 160 })
  readonly externalId: string;

  @Property({ type: 'string', length: 50 })
  type: string;

  @Property({ type: 'integer', nullable: true })
  number: number | null;

  @Property({ type: 'integer', nullable: true, index: true })
  year: number | null;

  @Property({ type: 'text', nullable: true })
  title: string | null;

  @Property({ type: 'text', nullable: true })
  summary: string | null;

  @Property({ type: 'string', length: 100, nullable: true })
  status: string | null;

  @Property({ type: 'string', length: 200, nullable: true })
  sourceStatus: string | null;

  @Property({ type: 'text', nullable: true })
  url: string | null;

  @OneToMany(() => LegislativeProposalAuthor, (author) => author.proposal)
  authors = new Collection<LegislativeProposalAuthor>(this);

  @Property({ type: 'timestamptz' })
  createdAt: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    source: LegislativeSource,
    externalId: string,
    type: string,
    options: {
      number?: number | null;
      year?: number | null;
      title?: string | null;
      summary?: string | null;
      status?: string | null;
      sourceStatus?: string | null;
      url?: string | null;
      createdAt?: Date;
    } = {},
  ) {
    if (!Object.values(LegislativeSource).includes(source)) {
      throw new Error('Legislative proposal source is invalid');
    }
    if (!externalId.trim()) {
      throw new Error('Legislative proposal external identifier is required');
    }
    if (!type.trim()) {
      throw new Error('Legislative proposal type is required');
    }
    if (
      options.number != null &&
      (!Number.isSafeInteger(options.number) || options.number <= 0)
    ) {
      throw new Error('Legislative proposal number must be a positive integer');
    }
    if (
      options.year != null &&
      (!Number.isSafeInteger(options.year) ||
        options.year < 1800 ||
        options.year > 9999)
    ) {
      throw new Error('Legislative proposal year must be a four-digit year');
    }

    this.source = source;
    this.externalId = externalId;
    this.type = type;
    this.number = options.number ?? null;
    this.year = options.year ?? null;
    this.title = options.title ?? null;
    this.summary = options.summary ?? null;
    this.status = options.status ?? null;
    this.sourceStatus = options.sourceStatus ?? null;
    this.url = options.url ?? null;
    this.createdAt = options.createdAt ?? new Date();
    this.updatedAt = this.createdAt;
  }
}
