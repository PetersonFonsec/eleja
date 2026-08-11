export interface CamaraProposalReference {
  externalId: string;
  sourceUrl: string;
}

export interface CamaraProposalRecord {
  externalId: string;
  sourceUrl: string;
  type: string;
  number: number;
  year: number;
  summary: string | null;
  sourceStatus: string | null;
  presentedAt: string | null;
}

export interface CamaraProposalAuthorRecord {
  proposalExternalId: string;
  deputyExternalId: string | null;
  authorType: string;
  sourceAuthorOrder: number | null;
  isPrimaryAuthor: boolean;
}
