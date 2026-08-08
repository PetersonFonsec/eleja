import { Collection } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { Candidacy } from './candidacy.entity.js';
import { CandidateAssetSource } from './candidate-asset-source.entity.js';

@Entity({ tableName: 'candidate_assets' })
@Unique({
  name: 'candidate_assets_candidacy_sequence_unique',
  properties: ['candidacy', 'sourceSequence'],
})
export class CandidateAsset {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @ManyToOne(() => Candidacy, { index: true, deleteRule: 'restrict' })
  readonly candidacy: Candidacy;

  @Property({ type: 'integer' })
  readonly sourceSequence: number;

  @Property({ type: 'string', length: 50 })
  typeCode: string;

  @Property({ type: 'string', length: 300 })
  type: string;

  @Property({ type: 'text', nullable: true })
  description: string | null;

  @Property({ type: 'decimal', precision: 24, scale: 2 })
  value: string;

  @OneToMany(() => CandidateAssetSource, (source) => source.candidateAsset)
  sources = new Collection<CandidateAssetSource>(this);

  @Property({ type: 'timestamptz' })
  createdAt: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    candidacy: Candidacy,
    sourceSequence: number,
    typeCode: string,
    type: string,
    description: string | null,
    value: string,
    createdAt = new Date(),
  ) {
    if (!candidacy) throw new Error('Candidate asset requires a candidacy');
    if (!Number.isSafeInteger(sourceSequence) || sourceSequence <= 0) {
      throw new Error('Candidate asset source sequence must be positive');
    }
    if (!typeCode.trim() || !type.trim()) {
      throw new Error('Candidate asset type is required');
    }
    if (!/^-?(0|[1-9]\d*)\.\d{2}$/.test(value)) {
      throw new Error('Candidate asset value must be an exact decimal');
    }
    this.candidacy = candidacy;
    this.sourceSequence = sourceSequence;
    this.typeCode = typeCode;
    this.type = type;
    this.description = description;
    this.value = value;
    this.createdAt = createdAt;
    this.updatedAt = createdAt;
  }
}
