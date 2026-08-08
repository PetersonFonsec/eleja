import type { Candidacy } from '@eleja/database';

export interface CandidateCardDto {
  id: string;
  name: string;
  ballotName: string;
  ballotNumber: number | null;
  photoUrl: string | null;
  status: string;
  state: string | null;
  city: string | null;
  party: PartyDto;
  office: OfficeDto;
  election: ElectionDto;
}

interface PartyDto {
  id: string;
  name: string;
  acronym: string;
  number: number | null;
}

interface OfficeDto {
  id: string;
  code: string;
  name: string;
  scope: string;
}

interface ElectionDto {
  id: string;
  year: number;
  type: string;
  round: number | null;
}

export interface CandidateDetailDto {
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
  party: PartyDto;
  office: OfficeDto;
  election: ElectionDto;
}

export function toCandidateCard(entity: Candidacy): CandidateCardDto {
  return {
    id: entity.id,
    name: entity.person.name,
    ballotName: entity.ballotName,
    ballotNumber: entity.ballotNumber,
    photoUrl: entity.photoUrl,
    status: entity.status,
    state: entity.state,
    city: entity.city,
    party: party(entity),
    office: office(entity),
    election: election(entity),
  };
}

export function toCandidateDetail(entity: Candidacy): CandidateDetailDto {
  return {
    id: entity.id,
    person: {
      name: entity.person.name,
      birthDate: entity.person.birthDate,
      gender: entity.person.gender,
      education: entity.person.education,
      occupation: entity.person.occupation,
    },
    candidacy: {
      ballotName: entity.ballotName,
      ballotNumber: entity.ballotNumber,
      photoUrl: entity.photoUrl,
      status: entity.status,
      sourceStatus: entity.sourceStatus,
      state: entity.state,
      city: entity.city,
    },
    party: party(entity),
    office: office(entity),
    election: election(entity),
  };
}

function party(entity: Candidacy): PartyDto {
  return {
    id: entity.party.id,
    name: entity.party.name,
    acronym: entity.party.acronym,
    number: entity.party.number,
  };
}

function office(entity: Candidacy): OfficeDto {
  return {
    id: entity.office.id,
    code: entity.office.code,
    name: entity.office.name,
    scope: entity.office.scope,
  };
}

function election(entity: Candidacy): ElectionDto {
  return {
    id: entity.election.id,
    year: entity.election.year,
    type: entity.election.type,
    round: entity.election.round,
  };
}
