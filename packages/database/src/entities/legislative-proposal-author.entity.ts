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
import { LegislativeProposalAuthorRole } from './legislative-proposal-author-role.js';
import { LegislativeProposal } from './legislative-proposal.entity.js';
import { Person } from './person.entity.js';

@Entity({ tableName: 'legislative_proposal_authors' })
@Unique({
  name: 'legislative_proposal_authors_proposal_person_unique',
  properties: ['proposal', 'person'],
})
export class LegislativeProposalAuthor {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @ManyToOne(() => LegislativeProposal, {
    index: true,
    deleteRule: 'restrict',
  })
  readonly proposal: LegislativeProposal;

  @ManyToOne(() => Person, { index: true, deleteRule: 'restrict' })
  readonly person: Person;

  @ManyToOne(() => LegislativeMandate, {
    index: true,
    nullable: true,
    deleteRule: 'restrict',
  })
  mandate: LegislativeMandate | null;

  @Enum({ items: () => LegislativeProposalAuthorRole })
  role: LegislativeProposalAuthorRole;

  @Property({ type: 'boolean', default: false })
  isPrimaryAuthor: boolean;

  @Property({ type: 'integer', nullable: true })
  sourceAuthorOrder: number | null;

  @Property({ type: 'timestamptz' })
  createdAt: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    proposal: LegislativeProposal,
    person: Person,
    options: {
      mandate?: LegislativeMandate | null;
      role?: LegislativeProposalAuthorRole;
      isPrimaryAuthor?: boolean;
      sourceAuthorOrder?: number | null;
      createdAt?: Date;
    } = {},
  ) {
    if (!proposal || !person) {
      throw new Error('Proposal authorship requires a proposal and person');
    }
    if (options.mandate != null && options.mandate.person !== person) {
      throw new Error('Proposal authorship mandate must belong to its person');
    }
    const role = options.role ?? LegislativeProposalAuthorRole.UNKNOWN;
    if (!Object.values(LegislativeProposalAuthorRole).includes(role)) {
      throw new Error('Proposal author role is invalid');
    }
    if (
      options.sourceAuthorOrder != null &&
      (!Number.isSafeInteger(options.sourceAuthorOrder) ||
        options.sourceAuthorOrder <= 0)
    ) {
      throw new Error('Proposal author order must be a positive integer');
    }

    this.proposal = proposal;
    this.person = person;
    this.mandate = options.mandate ?? null;
    this.role = role;
    this.isPrimaryAuthor = options.isPrimaryAuthor ?? false;
    this.sourceAuthorOrder = options.sourceAuthorOrder ?? null;
    this.createdAt = options.createdAt ?? new Date();
    this.updatedAt = this.createdAt;
  }
}
