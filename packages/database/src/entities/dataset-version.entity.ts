import { Collection } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { BatchRun } from './batch-run.entity.js';
import { DatasetVersionStatus } from './dataset-version-status.js';
import {
  assertValidCounters,
  type ProcessingCounters,
} from './processing-counters.js';

@Entity({ tableName: 'dataset_versions' })
export class DatasetVersion {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @Property({ type: 'string', length: 64, unique: true })
  version: string;

  @Enum({ items: () => DatasetVersionStatus, fieldName: 'status' })
  private statusValue = DatasetVersionStatus.PROCESSING;

  @Property({ type: 'timestamptz' })
  startedAt: Date;

  @Property({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null = null;

  @Property({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null = null;

  @Property({ type: 'timestamptz', nullable: true })
  sourceUpdatedAt: Date | null;

  @Property({ type: 'integer', default: 0 })
  recordsRead = 0;

  @Property({ type: 'integer', default: 0 })
  recordsInserted = 0;

  @Property({ type: 'integer', default: 0 })
  recordsUpdated = 0;

  @Property({ type: 'integer', default: 0 })
  recordsRejected = 0;

  @OneToMany(() => BatchRun, (batchRun) => batchRun.datasetVersion)
  batchRuns = new Collection<BatchRun>(this);

  @Property({ type: 'timestamptz' })
  createdAt: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    version: string,
    sourceUpdatedAt: Date | null = null,
    startedAt = new Date(),
  ) {
    if (version.trim().length === 0) {
      throw new Error('Dataset version must not be empty');
    }

    this.version = version;
    this.sourceUpdatedAt = sourceUpdatedAt;
    this.startedAt = startedAt;
    this.createdAt = startedAt;
    this.updatedAt = startedAt;
  }

  get status(): DatasetVersionStatus {
    return this.statusValue;
  }

  recordCounters(counters: ProcessingCounters): void {
    assertValidCounters(counters);
    Object.assign(this, counters);
  }

  markReady(at = new Date()): void {
    this.assertStatus(DatasetVersionStatus.PROCESSING, 'mark as ready');
    this.statusValue = DatasetVersionStatus.READY;
    this.finishedAt = at;
  }

  publish(at = new Date()): void {
    this.assertStatus(DatasetVersionStatus.READY, 'publish');
    this.statusValue = DatasetVersionStatus.PUBLISHED;
    this.publishedAt = at;
  }

  markFailed(at = new Date()): void {
    if (this.statusValue === DatasetVersionStatus.PUBLISHED) {
      throw new Error('A published dataset cannot be marked as failed');
    }

    this.statusValue = DatasetVersionStatus.FAILED;
    this.finishedAt = at;
  }

  private assertStatus(
    expected: DatasetVersionStatus,
    operation: string,
  ): void {
    if (this.statusValue !== expected) {
      throw new Error(
        `Cannot ${operation} dataset in ${this.statusValue} status`,
      );
    }
  }
}
