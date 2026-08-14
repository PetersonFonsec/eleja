export type ElectoralPipelineStage =
  | 'INITIALIZE'
  | 'EXTRACT_CANDIDATES'
  | 'PARSE_CANDIDATES'
  | 'NORMALIZE_CANDIDATES'
  | 'PERSIST_CANDIDATES'
  | 'EXTRACT_ASSETS'
  | 'PARSE_ASSETS'
  | 'NORMALIZE_ASSETS'
  | 'PERSIST_ASSETS'
  | 'EXPORT_DATASETS'
  | 'COMPLETE';

export interface CandidatePipelineStatistics {
  recordsRead: number;
  parserRejected: number;
  normalized: number;
  normalizationRejected: number;
  inserted: number;
  updated: number;
  unchanged: number;
  persistenceRejected: number;
  matchedByStableIdentifier: number;
  matchedByStrongComposite: number;
  newPersonsCreated: number;
  ambiguousMatches: number;
}

export interface AssetPipelineStatistics {
  recordsRead: number;
  parserRejected: number;
  normalized: number;
  normalizationRejected: number;
  inserted: number;
  updated: number;
  unchanged: number;
  candidacyNotFound: number;
}

export interface PipelineCounters {
  recordsRead: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsRejected: number;
}

export interface PipelineExecutionAttempt {
  complete(counters: PipelineCounters): Promise<void>;
  fail(error: Error, counters: PipelineCounters): Promise<void>;
}

export interface PipelineExecutionStore {
  begin(version: string): Promise<PipelineExecutionAttempt>;
}
