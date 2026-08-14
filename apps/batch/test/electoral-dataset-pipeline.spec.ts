import type { initializeDatabase } from '@eleja/database';
import { describe, expect, it, vi } from 'vitest';
import { ElectoralDatasetPipeline } from '../src/orchestration/electoral-dataset-pipeline.js';
import type {
  AssetPipelineStatistics,
  CandidatePipelineStatistics,
  PipelineCounters,
  PipelineExecutionAttempt,
} from '../src/orchestration/pipeline-types.js';

const candidateStats: CandidatePipelineStatistics = {
  recordsRead: 10,
  parserRejected: 1,
  normalized: 8,
  normalizationRejected: 1,
  inserted: 5,
  updated: 2,
  unchanged: 1,
  persistenceRejected: 0,
  matchedByStableIdentifier: 0,
  matchedByStrongComposite: 0,
  newPersonsCreated: 0,
  ambiguousMatches: 0,
};
const assetStats: AssetPipelineStatistics = {
  recordsRead: 20,
  parserRejected: 1,
  normalized: 18,
  normalizationRejected: 1,
  inserted: 12,
  updated: 3,
  unchanged: 2,
  candidacyNotFound: 1,
};

describe('ElectoralDatasetPipeline', () => {
  it('runs candidates before assets and exports only after both succeed', async () => {
    const fixture = setup();

    const result = await fixture.pipeline.execute(2026, '2026-08-08');

    expect(fixture.operations).toEqual([
      'candidates',
      'assets',
      'export',
      'complete',
    ]);
    expect(result.status).toBe('READY');
    expect(fixture.complete).toHaveBeenCalledWith(expectedCounters());
    expect(fixture.exporter.export).toHaveBeenCalledWith(
      2026,
      '/private/tmp/eleja-test-exports/2026/2026-08-08',
      {
        version: '2026-08-08',
        status: 'READY',
        expectedRows: { candidates: 8, assets: 17 },
      },
    );
  });

  it('stops before assets and export when candidates fail', async () => {
    const fixture = setup({ candidateError: new Error('candidate failure') });

    await expect(fixture.pipeline.execute(2026, '2026-08-08')).rejects.toThrow(
      'candidate failure',
    );

    expect(fixture.operations).toEqual(['candidates', 'fail']);
    expect(fixture.fail).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'candidate failure' }),
      expect.any(Object),
    );
  });

  it('stops before export when assets fail', async () => {
    const fixture = setup({ assetError: new Error('asset failure') });

    await expect(fixture.pipeline.execute(2026, '2026-08-08')).rejects.toThrow(
      'asset failure',
    );

    expect(fixture.operations).toEqual(['candidates', 'assets', 'fail']);
  });

  it('marks the attempt failed when export validation fails', async () => {
    const fixture = setup({ exportError: new Error('export failure') });

    await expect(fixture.pipeline.execute(2026, '2026-08-08')).rejects.toThrow(
      'export failure',
    );

    expect(fixture.operations).toEqual([
      'candidates',
      'assets',
      'export',
      'fail',
    ]);
    expect(fixture.complete).not.toHaveBeenCalled();
  });
});

function setup(options?: {
  candidateError?: Error;
  assetError?: Error;
  exportError?: Error;
}) {
  const operations: string[] = [];
  const complete = vi.fn(async () => {
    operations.push('complete');
  });
  const fail = vi.fn(async () => {
    operations.push('fail');
  });
  const attempt: PipelineExecutionAttempt = { complete, fail };
  const executions = { begin: vi.fn(async () => attempt) };
  const candidates = {
    execute: vi.fn(async () => {
      operations.push('candidates');
      if (options?.candidateError) throw options.candidateError;
      return candidateStats;
    }),
  };
  const assets = {
    execute: vi.fn(async () => {
      operations.push('assets');
      if (options?.assetError) throw options.assetError;
      return assetStats;
    }),
  };
  const exporter = {
    export: vi.fn(async () => {
      operations.push('export');
      if (options?.exportError) throw options.exportError;
      return { datasets: [] };
    }),
  };
  const orm = {
    em: {
      fork: () => ({
        count: vi.fn().mockResolvedValueOnce(8).mockResolvedValueOnce(17),
      }),
    },
  } as unknown as Awaited<ReturnType<typeof initializeDatabase>>;
  const pipeline = new ElectoralDatasetPipeline(
    orm,
    executions,
    candidates,
    assets,
    exporter,
    '/private/tmp/eleja-test-exports',
    { log: vi.fn() },
  );
  return { pipeline, operations, complete, fail, exporter };
}

function expectedCounters(): PipelineCounters {
  return {
    recordsRead: 30,
    recordsInserted: 17,
    recordsUpdated: 5,
    recordsRejected: 5,
  };
}
