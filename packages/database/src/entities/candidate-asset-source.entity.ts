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
import { CandidateAsset } from './candidate-asset.entity.js';
import { CandidateSourceType } from './candidate-source-type.js';

@Entity({ tableName: 'candidate_asset_sources' })
@Unique({
  name: 'candidate_asset_sources_observation_unique',
  properties: ['candidateAsset', 'rawChecksum', 'sourceIdentifier'],
})
export class CandidateAssetSource {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @ManyToOne(() => CandidateAsset, { index: true, deleteRule: 'restrict' })
  readonly candidateAsset: CandidateAsset;

  @Enum({ items: () => CandidateSourceType })
  readonly type: CandidateSourceType;

  @Property({ type: 'string', length: 200 })
  name: string;

  @Property({ type: 'string', length: 160 })
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
    candidateAsset: CandidateAsset,
    type: CandidateSourceType,
    name: string,
    sourceIdentifier: string,
    rawStorageKey: string,
    rawChecksum: string,
    options: { sourceUrl?: string | null; importedAt?: Date } = {},
  ) {
    if (!candidateAsset) throw new Error('Asset source requires an asset');
    if (!Object.values(CandidateSourceType).includes(type)) {
      throw new Error('Asset source type is invalid');
    }
    if (!name.trim() || !sourceIdentifier.trim()) {
      throw new Error('Asset source identity is required');
    }
    if (!rawStorageKey.trim() || rawStorageKey.startsWith('/')) {
      throw new Error('Asset source RAW storage key must be relative');
    }
    if (!/^[a-f0-9]{64}$/i.test(rawChecksum)) {
      throw new Error('Asset source RAW checksum must be SHA-256');
    }
    const importedAt = options.importedAt ?? new Date();
    this.candidateAsset = candidateAsset;
    this.type = type;
    this.name = name;
    this.sourceIdentifier = sourceIdentifier;
    this.sourceUrl = options.sourceUrl ?? null;
    this.rawStorageKey = rawStorageKey;
    this.rawChecksum = rawChecksum.toLowerCase();
    this.importedAt = importedAt;
    this.lastCheckedAt = importedAt;
    this.createdAt = importedAt;
    this.updatedAt = importedAt;
  }
}
