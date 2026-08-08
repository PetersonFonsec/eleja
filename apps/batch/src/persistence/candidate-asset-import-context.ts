import type { CandidateSourceType } from '@eleja/database';

export interface CandidateAssetImportContext {
  sourceType: CandidateSourceType;
  sourceName: string;
  sourceUrl: string | null;
  rawStorageKey: string;
  rawChecksum: string;
  importedAt: Date;
}
