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
