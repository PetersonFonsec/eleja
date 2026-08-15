import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import type { CandidateAnalyticsFilters } from '../analytics.types.js';

const STATES = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
  'BR',
]);
const OFFICES = new Set([
  'PRESIDENT',
  'VICE_PRESIDENT',
  'GOVERNOR',
  'VICE_GOVERNOR',
  'SENATOR',
  'FEDERAL_DEPUTY',
  'STATE_DEPUTY',
  'DISTRICT_DEPUTY',
  'SENATOR_FIRST_ALTERNATE',
  'SENATOR_SECOND_ALTERNATE',
  'MAYOR',
  'CITY_COUNCILOR',
]);

export interface AnalyticsFilterQueryDto {
  year: number;
  office?: string;
  state?: string;
  party?: string;
}

export interface AnalyticsRankingQueryDto extends AnalyticsFilterQueryDto {
  limit: number;
}

@Injectable()
export class AnalyticsFilterQueryPipe implements PipeTransform<
  Record<string, unknown>,
  AnalyticsFilterQueryDto
> {
  transform(query: Record<string, unknown>): AnalyticsFilterQueryDto {
    return analyticsQuery(query, false);
  }
}

@Injectable()
export class AnalyticsRankingQueryPipe implements PipeTransform<
  Record<string, unknown>,
  AnalyticsRankingQueryDto
> {
  transform(query: Record<string, unknown>): AnalyticsRankingQueryDto {
    return analyticsQuery(query, true) as AnalyticsRankingQueryDto;
  }
}

export function toAnalyticsFilters(
  query: AnalyticsFilterQueryDto,
): CandidateAnalyticsFilters {
  return {
    electionYear: query.year,
    officeCode: query.office,
    state: query.state,
    partyAcronym: query.party,
  };
}

function analyticsQuery(
  query: Record<string, unknown>,
  ranking: boolean,
): AnalyticsFilterQueryDto | AnalyticsRankingQueryDto {
  const year = requiredInteger(query.year, 'year');
  if (year < 1900 || year > 9999)
    throw new BadRequestException('year must be between 1900 and 9999');
  const state = optionalString(query.state, 'state')?.toUpperCase();
  if (state && !STATES.has(state))
    throw new BadRequestException('state must be a valid Brazilian UF');
  const office = optionalString(query.office, 'office')?.toUpperCase();
  if (office && !OFFICES.has(office))
    throw new BadRequestException('office must be a canonical office code');
  const party = optionalString(query.party, 'party')?.toUpperCase();
  const base = { year, office, state, party };
  if (!ranking) return base;
  const limit =
    query.limit === undefined ? 10 : requiredInteger(query.limit, 'limit');
  if (limit < 1 || limit > 100)
    throw new BadRequestException('limit must be between 1 and 100');
  return { ...base, limit };
}

function requiredInteger(value: unknown, name: string): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value))
    throw new BadRequestException(`${name} must be an integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed))
    throw new BadRequestException(`${name} must be an integer`);
  return parsed;
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim())
    throw new BadRequestException(`${name} must be a non-empty string`);
  return value.trim();
}
