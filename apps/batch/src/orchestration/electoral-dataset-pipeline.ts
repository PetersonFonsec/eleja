import {
  CandidateAsset,
  Candidacy,
  type initializeDatabase,
} from '@eleja/database';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { PublicDatasetExporter } from '../export/public-dataset-exporter.js';
import type { CsvExportResult } from '../export/csv-export-writer.js';
import type {
  AssetPipelineStatistics,
  CandidatePipelineStatistics,
  ElectoralPipelineStage,
  PipelineCounters,
  PipelineExecutionStore,
} from './pipeline-types.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;

interface CandidatePipeline {
  execute(
    year: number,
    stage: (stage: ElectoralPipelineStage) => void,
  ): Promise<CandidatePipelineStatistics>;
}

interface AssetPipeline {
  execute(
    year: number,
    stage: (stage: ElectoralPipelineStage) => void,
  ): Promise<AssetPipelineStatistics>;
}

interface DatasetExporter {
  export(
    year: number,
    directory: string,
    options: {
      version: string;
      status: 'READY';
      expectedRows: { candidates: number; assets: number };
    },
  ): Promise<{ datasets: CsvExportResult[] }>;
}

export interface ElectoralDatasetPipelineResult {
  year: number;
  version: string;
  status: 'READY';
  outputDirectory: string;
  candidates: CandidatePipelineStatistics;
  assets: AssetPipelineStatistics;
  exports: CsvExportResult[];
  durationMs: number;
}

export class ElectoralDatasetPipeline {
  constructor(
    private readonly orm: Database,
    private readonly executions: PipelineExecutionStore,
    private readonly candidates: CandidatePipeline,
    private readonly assets: AssetPipeline,
    private readonly exporter: DatasetExporter,
    private readonly exportRoot: string,
    private readonly logger: { log(message: string): void } = console,
  ) {}

  async execute(
    year: number,
    version: string,
  ): Promise<ElectoralDatasetPipelineResult> {
    const startedAt = performance.now();
    const outputDirectory = join(this.exportRoot, String(year), version);
    this.stage('INITIALIZE');
    const attempt = await this.executions.begin(version);
    let candidateStats = emptyCandidates();
    let assetStats = emptyAssets();
    try {
      candidateStats = await this.candidates.execute(year, (stage) =>
        this.stage(stage),
      );
      assetStats = await this.assets.execute(year, (stage) =>
        this.stage(stage),
      );
      this.stage('EXPORT_DATASETS');
      const expectedRows = await this.databaseCounts(year);
      const exported = await this.exporter.export(year, outputDirectory, {
        version,
        status: 'READY',
        expectedRows,
      });
      const counters = aggregate(candidateStats, assetStats);
      await attempt.complete(counters);
      this.stage('COMPLETE');
      return {
        year,
        version,
        status: 'READY',
        outputDirectory,
        candidates: candidateStats,
        assets: assetStats,
        exports: exported.datasets,
        durationMs: Math.round(performance.now() - startedAt),
      };
    } catch (error: unknown) {
      const failure = error instanceof Error ? error : new Error(String(error));
      await rm(join(outputDirectory, 'metadata.json'), { force: true });
      await attempt.fail(failure, aggregate(candidateStats, assetStats));
      throw failure;
    }
  }

  private async databaseCounts(year: number) {
    const em = this.orm.em.fork();
    const [candidates, assets] = await Promise.all([
      em.count(Candidacy, { election: { year } }),
      em.count(CandidateAsset, { candidacy: { election: { year } } }),
    ]);
    return { candidates, assets };
  }

  private stage(stage: ElectoralPipelineStage): void {
    this.logger.log(`[${stage}]`);
  }
}

export function createDatasetExporter(
  orm: Database,
  batchSize: number,
): DatasetExporter {
  return new PublicDatasetExporter(orm, batchSize);
}

function aggregate(
  candidates: CandidatePipelineStatistics,
  assets: AssetPipelineStatistics,
): PipelineCounters {
  return {
    recordsRead: candidates.recordsRead + assets.recordsRead,
    recordsInserted: candidates.inserted + assets.inserted,
    recordsUpdated: candidates.updated + assets.updated,
    recordsRejected:
      candidates.parserRejected +
      candidates.normalizationRejected +
      candidates.persistenceRejected +
      assets.parserRejected +
      assets.normalizationRejected +
      assets.candidacyNotFound,
  };
}

function emptyCandidates(): CandidatePipelineStatistics {
  return {
    recordsRead: 0,
    parserRejected: 0,
    normalized: 0,
    normalizationRejected: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    persistenceRejected: 0,
    matchedByStableIdentifier: 0,
    matchedByStrongComposite: 0,
    newPersonsCreated: 0,
    ambiguousMatches: 0,
  };
}

function emptyAssets(): AssetPipelineStatistics {
  return {
    recordsRead: 0,
    parserRejected: 0,
    normalized: 0,
    normalizationRejected: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    candidacyNotFound: 0,
  };
}
