export interface CamaraDeputyMandateRecord {
  deputyExternalId: string;
  legislatureNumber: number;
  state: string | null;
  partyAcronym: string | null;
  occurredAt: string;
  situation: string | null;
  statusDescription: string | null;
  legislatureStartedAt: string;
  legislatureEndedAt: string;
}
