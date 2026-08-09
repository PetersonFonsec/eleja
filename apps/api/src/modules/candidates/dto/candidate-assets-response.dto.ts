import type { CandidateAsset, Candidacy } from '@eleja/database';

export interface CandidateAssetDto {
  id: string;
  typeCode: string;
  type: string;
  description: string | null;
  value: string;
}

export interface CandidateAssetsResponseDto {
  candidateId: string;
  summary: {
    totalAssets: number;
    totalDeclaredValue: string;
  };
  data: CandidateAssetDto[];
}

export function toCandidateAssetsResponse(
  candidateId: Candidacy['id'],
  assets: CandidateAsset[],
  summary: { totalAssets: number; totalDeclaredValue: string },
): CandidateAssetsResponseDto {
  return {
    candidateId,
    summary,
    data: assets.map((asset) => ({
      id: asset.id,
      typeCode: asset.typeCode,
      type: asset.type,
      description: asset.description,
      value: asset.value,
    })),
  };
}
