import {
  BatchRun,
  DatasetVersion,
  DatasetVersionStatus,
  type initializeDatabase,
} from '@eleja/database';
import type {
  PipelineExecutionAttempt,
  PipelineExecutionStore,
} from './pipeline-types.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;

export class MikroOrmPipelineExecutionStore implements PipelineExecutionStore {
  constructor(
    private readonly orm: Database,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async begin(version: string): Promise<PipelineExecutionAttempt> {
    const em = this.orm.em.fork();
    let dataset = await em.findOne(DatasetVersion, { version });
    const startedAt = this.now();
    if (!dataset) {
      dataset = new DatasetVersion(version, null, startedAt);
      em.persist(dataset);
    } else if (dataset.status === DatasetVersionStatus.FAILED) {
      dataset.retry(startedAt);
    } else if (dataset.status === DatasetVersionStatus.READY) {
      throw new Error(`Dataset version ${version} is already READY`);
    } else if (dataset.status === DatasetVersionStatus.PUBLISHED) {
      throw new Error(`Dataset version ${version} is already PUBLISHED`);
    } else {
      throw new Error(`Dataset version ${version} is already PROCESSING`);
    }
    const run = new BatchRun(dataset, 'TSE_LOCAL_DATASET', startedAt);
    em.persist(run);
    await em.flush();
    const datasetId = dataset.id;
    const runId = run.id;
    return {
      complete: async (counters) => {
        await this.orm.em.transactional(async (completionEm) => {
          const currentDataset = await completionEm.findOneOrFail(
            DatasetVersion,
            datasetId,
          );
          const currentRun = await completionEm.findOneOrFail(BatchRun, runId);
          currentDataset.recordCounters(counters);
          currentRun.recordCounters(counters);
          currentDataset.markReady(this.now());
          currentRun.markSuccess(this.now());
        });
      },
      fail: async (error, counters) => {
        await this.orm.em.transactional(async (failureEm) => {
          const currentDataset = await failureEm.findOneOrFail(
            DatasetVersion,
            datasetId,
          );
          const currentRun = await failureEm.findOneOrFail(BatchRun, runId);
          currentDataset.recordCounters(counters);
          currentRun.recordCounters(counters);
          currentDataset.markFailed(this.now());
          currentRun.markFailed(conciseError(error), this.now());
        });
      },
    };
  }
}

function conciseError(error: Error): string {
  return error.message.trim().slice(0, 4000) || 'Unknown batch failure';
}
