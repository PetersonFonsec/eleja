export interface CandidateParty {
  id: string;
  name: string;
  acronym: string;
  number: number | null;
}

export interface CandidateOffice {
  id: string;
  code: string;
  name: string;
  scope: string;
}

export interface CandidateElection {
  id: string;
  year: number;
  type: string;
  round: number | null;
}

export interface CandidateListItem {
  id: string;
  name: string;
  ballotName: string;
  ballotNumber: number | null;
  photoUrl: string | null;
  status: string;
  state: string | null;
  city: string | null;
  party: CandidateParty;
  office: CandidateOffice;
  election: CandidateElection;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CandidateListResponse {
  data: CandidateListItem[];
  meta: PaginationMeta;
}

export interface CandidateListQuery {
  page: number;
  limit: number;
  year?: number;
  office?: string;
  state?: string;
  party?: string;
  name?: string;
}

export interface CandidateDetail {
  id: string;
  person: {
    name: string;
    birthDate: string | null;
    gender: string | null;
    education: string | null;
    occupation: string | null;
  };
  candidacy: {
    ballotName: string;
    ballotNumber: number | null;
    photoUrl: string | null;
    status: string;
    sourceStatus: string | null;
    state: string | null;
    city: string | null;
  };
  party: CandidateParty;
  office: CandidateOffice;
  election: CandidateElection;
}

export interface CandidateAsset {
  id: string;
  typeCode: string;
  type: string;
  description: string | null;
  value: string;
}

export interface CandidateAssetsResponse {
  candidateId: string;
  summary: {
    totalAssets: number;
    totalDeclaredValue: string;
  };
  data: CandidateAsset[];
}

export interface LegislativeMandate {
  id: string;
  body: string;
  legislatureNumber: number | null;
  state: string | null;
  partyAcronym: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: string;
  sourceStatus: string | null;
}
export interface CandidateLegislativeProfile {
  candidateId: string;
  hasLegislativeHistory: boolean;
  summary: {
    mandates: number;
    proposals: number;
    primaryAuthoredProposals: number;
    votes: number;
    expenses: { count: number; totalNetValue: string };
  };
  currentOrLatestMandate: LegislativeMandate | null;
}
export interface LegislativeProposalListItem {
  id: string;
  source: string;
  type: string;
  number: number | null;
  year: number | null;
  title: string | null;
  summary: string | null;
  status: string | null;
  sourceStatus: string | null;
  url: string | null;
  authorship: { isPrimaryAuthor: boolean; sourceAuthorOrder: number | null };
  mandate: { id: string; legislatureNumber: number | null } | null;
}
export interface LegislativeVoteListItem {
  id: string;
  position: string;
  sourcePosition: string;
  votedAt: string | null;
  voting: {
    id: string;
    source: string;
    dateTime: string;
    description: string | null;
    result: string;
    sourceResult: string | null;
    sourceUrl: string;
  };
  proposal: {
    id: string;
    type: string;
    number: number | null;
    year: number | null;
    summary: string | null;
  } | null;
  mandate: { id: string; legislatureNumber: number | null } | null;
}
export interface ParliamentaryExpenseListItem {
  id: string;
  source: string;
  year: number;
  month: number;
  categoryCode: string | null;
  category: string;
  supplierName: string | null;
  supplierDocument: string | null;
  documentNumber: string | null;
  documentType: string | null;
  documentDate: string | null;
  grossValue: string;
  deductionValue: string;
  netValue: string;
  sourceUrl: string | null;
  mandate: { id: string; legislatureNumber: number | null } | null;
}
export interface PagedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
export interface ProposalQuery {
  page: number;
  limit: number;
  type?: string;
  year?: number;
  primaryAuthor?: boolean;
}
export interface VoteQuery {
  page: number;
  limit: number;
  year?: number;
  position?: string;
}
export interface ExpenseQuery {
  page: number;
  limit: number;
  year?: number;
  month?: number;
  category?: string;
}
export type ProposalResponse = PagedResponse<LegislativeProposalListItem>;
export type VoteResponse = PagedResponse<LegislativeVoteListItem>;
export interface ExpenseResponse extends PagedResponse<ParliamentaryExpenseListItem> {
  summary: { totalNetValue: string };
}
