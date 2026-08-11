import { LegislativeSource } from '@eleja/database';

export interface NormalizedLegislativeProposalData {
  source: LegislativeSource.CAMARA;
  externalId: string;
  type: string;
  number: number;
  year: number;
  title: null;
  summary: string | null;
  status: null;
  sourceStatus: string | null;
  url: string;
  presentedAt: string | null;
}

export type LegislativeProposalNormalizationResult =
  | { status: 'NORMALIZED'; data: NormalizedLegislativeProposalData }
  | {
      status: 'REJECTED';
      issue: { externalId: string; reason: string };
    };
