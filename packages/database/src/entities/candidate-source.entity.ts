import {
  Entity,
  Enum,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { CandidateSourceType } from './candidate-source-type.js';
import { Candidacy } from './candidacy.entity.js';

@Entity({ tableName: 'candidate_sources' })
@Unique({
  name: 'candidate_sources_observation_unique',
  properties: ['candidacy', 'type', 'rawChecksum', 'sourceIdentifier'],
})
export class CandidateSource {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @ManyToOne(() => Candidacy, { index: true, deleteRule: 'restrict' })
  readonly candidacy: Candidacy;

  @Enum({ items: () => CandidateSourceType })
  readonly type: CandidateSourceType;

  @Property({ type: 'string', length: 200 })
  name: string;

  @Property({ type: 'string', length: 100, index: true })
  readonly sourceIdentifier: string;

  @Property({ type: 'text', nullable: true })
  sourceUrl: string | null;

  @Property({ type: 'text' })
  readonly rawStorageKey: string;

  @Index()
  @Property({ type: 'string', length: 64 })
  readonly rawChecksum: string;

  @Property({ type: 'timestamptz' })
  readonly importedAt: Date;

  @Property({ type: 'timestamptz' })
  lastCheckedAt: Date;

  @Property({ type: 'timestamptz' })
  createdAt: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    candidacy: Candidacy,
    type: CandidateSourceType,
    name: string,
    sourceIdentifier: string,
    rawStorageKey: string,
    rawChecksum: string,
    options: {
      sourceUrl?: string | null;
      importedAt?: Date;
      lastCheckedAt?: Date;
      createdAt?: Date;
    } = {},
  ) {
    if (!candidacy) throw new Error('Candidate source requires a candidacy');
    if (!Object.values(CandidateSourceType).includes(type)) {
      throw new Error('Candidate source type is invalid');
    }
    if (name.trim().length === 0) {
      throw new Error('Candidate source name must not be empty');
    }
    if (sourceIdentifier.trim().length === 0) {
      throw new Error('Candidate source identifier must not be empty');
    }
    if (rawStorageKey.trim().length === 0 || rawStorageKey.startsWith('/')) {
      throw new Error('Candidate source RAW storage key must be relative');
    }
    if (!/^[a-f0-9]{64}$/i.test(rawChecksum)) {
      throw new Error('Candidate source RAW checksum must be SHA-256');
    }

    const importedAt = options.importedAt ?? new Date();
    const lastCheckedAt = options.lastCheckedAt ?? importedAt;
    if (lastCheckedAt < importedAt) {
      throw new Error('Candidate source last check cannot precede import');
    }

    this.candidacy = candidacy;
    this.type = type;
    this.name = name;
    this.sourceIdentifier = sourceIdentifier;
    this.sourceUrl = options.sourceUrl ?? null;
    this.rawStorageKey = rawStorageKey;
    this.rawChecksum = rawChecksum.toLowerCase();
    this.importedAt = importedAt;
    this.lastCheckedAt = lastCheckedAt;
    this.createdAt = options.createdAt ?? importedAt;
    this.updatedAt = this.createdAt;
  }
}
