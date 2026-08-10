export interface CamaraDeputyRecord {
  externalId: string;
  name: string;
  parliamentaryName: string | null;
  state: string | null;
  partyAcronym: string | null;
  birthDate: string | null;
  photoUrl: string | null;
  profileUrl: string;
}
