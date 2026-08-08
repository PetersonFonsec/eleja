import {
  Entity,
  Enum,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { BatchRunStatus } from './batch-run-status.js';
import { DatasetVersion } from './dataset-version.entity.js';
import {
  assertValidCounters,
  type ProcessingCounters,
} from './processing-counters.js';

@Entity({ tableName: 'batch_runs' })
export class BatchRun {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @ManyToOne(() => DatasetVersion, { index: true })
  datasetVersion: DatasetVersion;

  @Property({ type: 'string', length: 100 })
  source: string;

  @Enum({ items: () => BatchRunStatus, fieldName: 'status', index: true })
  private statusValue = BatchRunStatus.RUNNING;

  @Property({ type: 'timestamptz' })
  startedAt: Date;

  @Property({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null = null;

  @Property({ type: 'integer', default: 0 })
  recordsRead = 0;

  @Property({ type: 'integer', default: 0 })
  recordsInserted = 0;

  @Property({ type: 'integer', default: 0 })
  recordsUpdated = 0;

  @Property({ type: 'integer', default: 0 })
  recordsRejected = 0;

  @Property({ type: 'text', nullable: true })
  errorMessage: string | null = null;

  @Property({ type: 'timestamptz' })
  createdAt: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    datasetVersion: DatasetVersion,
    source: string,
    startedAt = new Date(),
  ) {
    if (source.trim().length === 0) {
      throw new Error('Batch source must not be empty');
    }

    this.datasetVersion = datasetVersion;
    this.source = source;
    this.startedAt = startedAt;
    this.createdAt = startedAt;
    this.updatedAt = startedAt;
  }

  get status(): BatchRunStatus {
    return this.statusValue;
  }

  recordCounters(counters: ProcessingCounters): void {
    this.assertRunning();
    assertValidCounters(counters);
    Object.assign(this, counters);
  }

  markSuccess(at = new Date()): void {
    this.finish(BatchRunStatus.SUCCESS, at);
  }

  markPartial(at = new Date()): void {
    this.finish(BatchRunStatus.PARTIAL, at);
  }

  markFailed(errorMessage: string, at = new Date()): void {
    this.assertRunning();
    const conciseMessage = errorMessage.trim();
    if (conciseMessage.length === 0) {
      throw new Error('A failed batch run requires an error message');
    }

    this.errorMessage = conciseMessage;
    this.statusValue = BatchRunStatus.FAILED;
    this.finishedAt = at;
  }

  private finish(
    status: BatchRunStatus.SUCCESS | BatchRunStatus.PARTIAL,
    at: Date,
  ): void {
    this.assertRunning();
    this.statusValue = status;
    this.finishedAt = at;
  }

  private assertRunning(): void {
    if (this.statusValue !== BatchRunStatus.RUNNING) {
      throw new Error(`Batch run is already ${this.statusValue}`);
    }
  }
}
