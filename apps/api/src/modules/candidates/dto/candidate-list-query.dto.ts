import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';

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

export interface CandidateListQueryDto {
  page: number;
  limit: number;
  year?: number;
  office?: string;
  state?: string;
  party?: string;
  name?: string;
}

@Injectable()
export class CandidateListQueryPipe implements PipeTransform<
  Record<string, unknown>,
  CandidateListQueryDto
> {
  transform(query: Record<string, unknown>): CandidateListQueryDto {
    const page = positiveInteger(query.page, 'page', 1);
    const limit = positiveInteger(query.limit, 'limit', 20);
    if (limit > 100) throw new BadRequestException('limit must not exceed 100');

    const year = optionalInteger(query.year, 'year');
    if (year !== undefined && (year < 1900 || year > 9999)) {
      throw new BadRequestException('year must be between 1900 and 9999');
    }
    const state = optionalString(query.state, 'state')?.toUpperCase();
    if (state && !STATES.has(state)) {
      throw new BadRequestException('state must be a valid Brazilian UF');
    }
    const office = optionalString(query.office, 'office')?.toUpperCase();
    const party = optionalString(query.party, 'party')?.toUpperCase();
    const name = optionalString(query.name, 'name');
    return { page, limit, year, office, state, party, name };
  }
}

function positiveInteger(
  value: unknown,
  name: string,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  const parsed = integer(value, name);
  if (parsed <= 0) throw new BadRequestException(`${name} must be positive`);
  return parsed;
}

function optionalInteger(value: unknown, name: string): number | undefined {
  return value === undefined ? undefined : integer(value, name);
}

function integer(value: unknown, name: string): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new BadRequestException(`${name} must be an integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new BadRequestException(`${name} must be an integer`);
  }
  return parsed;
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${name} must be a non-empty string`);
  }
  return value.trim();
}
