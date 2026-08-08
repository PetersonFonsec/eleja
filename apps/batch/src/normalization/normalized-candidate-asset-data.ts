export interface NormalizedCandidateAssetData {
  sourceCandidateId: string;
  asset: {
    sourceSequence: number;
    typeCode: string;
    type: string;
    description: string | null;
    value: string;
  };
}

export type CandidateAssetNormalizationResult =
  | { status: 'SUCCESS'; data: NormalizedCandidateAssetData }
  | {
      status: 'REJECTED';
      issue: { field: string; value: unknown; reason: string };
    };
