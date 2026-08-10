import { LegislativeBody, LegislativeMandateStatus } from '@eleja/database';

export interface NormalizedLegislativeMandateData {
  personExternalId: string;
  mandate: {
    body: LegislativeBody;
    externalMandateId: string | null;
    legislatureNumber: number;
    state: string | null;
    partyAcronym: string | null;
    startedAt: string;
    endedAt: string | null;
    status: LegislativeMandateStatus;
    sourceStatus: string | null;
  };
}

export type LegislativeMandateNormalizationResult =
  | { status: 'NORMALIZED'; data: NormalizedLegislativeMandateData }
  | {
      status: 'REJECTED';
      issue: {
        deputyExternalId: string;
        legislatureNumber: number;
        reason: string;
      };
    };
