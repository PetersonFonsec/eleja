import { LegislativeVotePosition } from '@eleja/database';
import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';

export interface PageQuery {
  page: number;
  limit: number;
}
export interface ProposalQuery extends PageQuery {
  type?: string;
  year?: number;
  primaryAuthor?: boolean;
}
export interface VoteQuery extends PageQuery {
  year?: number;
  position?: LegislativeVotePosition;
  proposalId?: string;
}
export interface ExpenseQuery extends PageQuery {
  year?: number;
  month?: number;
  category?: string;
}

abstract class BasePipe<T> implements PipeTransform<
  Record<string, unknown>,
  T
> {
  abstract transform(query: Record<string, unknown>): T;
  protected page(query: Record<string, unknown>): PageQuery {
    const page = integer(query.page, 'page', 1);
    const limit = integer(query.limit, 'limit', 20);
    if (page < 1) throw new BadRequestException('page must be positive');
    if (limit < 1 || limit > 100)
      throw new BadRequestException('limit must be between 1 and 100');
    return { page, limit };
  }
  protected year(value: unknown): number | undefined {
    if (value === undefined) return undefined;
    const year = integer(value, 'year');
    if (year < 1900 || year > 9999)
      throw new BadRequestException('year must be between 1900 and 9999');
    return year;
  }
}
@Injectable()
export class ProposalQueryPipe extends BasePipe<ProposalQuery> {
  transform(query: Record<string, unknown>): ProposalQuery {
    return {
      ...this.page(query),
      type: text(query.type, 'type')?.toUpperCase(),
      year: this.year(query.year),
      primaryAuthor: boolean(query.primaryAuthor, 'primaryAuthor'),
    };
  }
}
@Injectable()
export class VoteQueryPipe extends BasePipe<VoteQuery> {
  transform(query: Record<string, unknown>): VoteQuery {
    const raw = text(query.position, 'position');
    const position = raw?.toUpperCase() as LegislativeVotePosition | undefined;
    if (position && !Object.values(LegislativeVotePosition).includes(position))
      throw new BadRequestException('position is invalid');
    const proposalId = text(query.proposalId, 'proposalId');
    if (
      proposalId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        proposalId,
      )
    )
      throw new BadRequestException('proposalId must be a UUID v4');
    return {
      ...this.page(query),
      year: this.year(query.year),
      position,
      proposalId,
    };
  }
}
@Injectable()
export class ExpenseQueryPipe extends BasePipe<ExpenseQuery> {
  transform(query: Record<string, unknown>): ExpenseQuery {
    const month =
      query.month === undefined ? undefined : integer(query.month, 'month');
    if (month !== undefined && (month < 1 || month > 12))
      throw new BadRequestException('month must be between 1 and 12');
    return {
      ...this.page(query),
      year: this.year(query.year),
      month,
      category: text(query.category, 'category'),
    };
  }
}
function integer(value: unknown, name: string, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value))
    throw new BadRequestException(`${name} must be an integer`);
  const result = Number(value);
  if (!Number.isSafeInteger(result))
    throw new BadRequestException(`${name} must be an integer`);
  return result;
}
function text(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim())
    throw new BadRequestException(`${name} must be a non-empty string`);
  return value.trim();
}
function boolean(value: unknown, name: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new BadRequestException(`${name} must be true or false`);
}
