import {
  Candidacy,
  LegislativeMandate,
  LegislativeMandateStatus,
  LegislativeProposalAuthor,
  LegislativeVote,
  ParliamentaryExpense,
  type Person,
} from '@eleja/database';
import { LoadStrategy, type FilterQuery } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ExpenseQuery,
  ProposalQuery,
  VoteQuery,
} from './dto/legislative-query.dto.js';
import {
  expenseDto,
  mandateDto,
  proposalDto,
  voteDto,
} from './dto/legislative-response.dto.js';

@Injectable()
export class CandidateLegislativeQueryService {
  constructor(@Inject(EntityManager) private readonly em: EntityManager) {}
  private async person(candidateId: Candidacy['id']): Promise<Person> {
    const candidate = await this.em.findOne(
      Candidacy,
      { id: candidateId },
      { populate: ['person'] },
    );
    if (!candidate) throw new NotFoundException('Candidate not found');
    return candidate.person;
  }
  async mandates(candidateId: Candidacy['id']) {
    const person = await this.person(candidateId);
    const rows = await this.em.find(
      LegislativeMandate,
      { person },
      { orderBy: { startedAt: 'DESC', legislatureNumber: 'DESC', id: 'ASC' } },
    );
    return rows.map(mandateDto);
  }
  async proposals(candidateId: Candidacy['id'], query: ProposalQuery) {
    const person = await this.person(candidateId);
    const where: FilterQuery<LegislativeProposalAuthor> = { person };
    if (query.primaryAuthor !== undefined)
      where.isPrimaryAuthor = query.primaryAuthor;
    if (query.type || query.year !== undefined)
      where.proposal = {
        ...(query.type ? { type: query.type } : {}),
        ...(query.year !== undefined ? { year: query.year } : {}),
      };
    const [rows, total] = await this.em.findAndCount(
      LegislativeProposalAuthor,
      where,
      {
        populate: ['proposal', 'mandate'],
        strategy: LoadStrategy.JOINED,
        orderBy: { proposal: { year: 'DESC', number: 'DESC', id: 'ASC' } },
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
      },
    );
    return page(rows.map(proposalDto), query, total);
  }
  async votes(candidateId: Candidacy['id'], query: VoteQuery) {
    const person = await this.person(candidateId);
    const where: FilterQuery<LegislativeVote> = { person };
    if (query.position) where.position = query.position;
    const voting: Record<string, unknown> = {};
    if (query.year !== undefined)
      voting.dateTime = {
        $gte: new Date(`${query.year}-01-01T00:00:00Z`),
        $lt: new Date(`${query.year + 1}-01-01T00:00:00Z`),
      };
    if (query.proposalId) voting.proposal = { id: query.proposalId };
    if (Object.keys(voting).length) where.voting = voting as never;
    const [rows, total] = await this.em.findAndCount(LegislativeVote, where, {
      populate: ['voting.proposal', 'mandate'],
      strategy: LoadStrategy.JOINED,
      orderBy: { voting: { dateTime: 'DESC' }, votedAt: 'DESC', id: 'ASC' },
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    });
    return page(rows.map(voteDto), query, total);
  }
  async expenses(candidateId: Candidacy['id'], query: ExpenseQuery) {
    const person = await this.person(candidateId);
    const where: FilterQuery<ParliamentaryExpense> = { person };
    if (query.year !== undefined) where.year = query.year;
    if (query.month !== undefined) where.month = query.month;
    if (query.category) where.category = { $ilike: query.category };
    const [rows, total, aggregate] = await Promise.all([
      this.em.find(ParliamentaryExpense, where, {
        populate: ['mandate'],
        strategy: LoadStrategy.JOINED,
        orderBy: {
          documentDate: 'DESC',
          year: 'DESC',
          month: 'DESC',
          id: 'ASC',
        },
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
      }),
      this.em.count(ParliamentaryExpense, where),
      this.expenseTotal(person.id, query),
    ]);
    return {
      ...page(rows.map(expenseDto), query, total),
      summary: { totalNetValue: aggregate },
    };
  }
  async profile(candidateId: Candidacy['id']) {
    const person = await this.person(candidateId);
    const [mandates, proposals, primary, votes, expenses, total, active] =
      await Promise.all([
        this.em.count(LegislativeMandate, { person }),
        this.em.count(LegislativeProposalAuthor, { person }),
        this.em.count(LegislativeProposalAuthor, {
          person,
          isPrimaryAuthor: true,
        }),
        this.em.count(LegislativeVote, { person }),
        this.em.count(ParliamentaryExpense, { person }),
        this.expenseTotal(person.id, {}),
        this.em.findOne(
          LegislativeMandate,
          { person, status: LegislativeMandateStatus.ACTIVE },
          { orderBy: { startedAt: 'DESC', id: 'ASC' } },
        ),
      ]);
    const latest =
      active ??
      (await this.em.findOne(
        LegislativeMandate,
        { person },
        {
          orderBy: { startedAt: 'DESC', legislatureNumber: 'DESC', id: 'ASC' },
        },
      ));
    return {
      candidateId,
      hasLegislativeHistory: mandates + proposals + votes + expenses > 0,
      summary: {
        mandates,
        proposals,
        primaryAuthoredProposals: primary,
        votes,
        expenses: { count: expenses, totalNetValue: total },
      },
      currentOrLatestMandate: latest ? mandateDto(latest) : null,
    };
  }
  private async expenseTotal(
    personId: Person['id'],
    query: Partial<ExpenseQuery>,
  ): Promise<string> {
    const clauses = ['"person_id" = ?'];
    const params: unknown[] = [personId];
    if (query.year !== undefined) {
      clauses.push('"year" = ?');
      params.push(query.year);
    }
    if (query.month !== undefined) {
      clauses.push('"month" = ?');
      params.push(query.month);
    }
    if (query.category) {
      clauses.push('lower("category") = lower(?)');
      params.push(query.category);
    }
    const rows = await this.em
      .getConnection()
      .execute<Array<{ total: string }>>(
        `select coalesce(sum("net_value"), 0)::text as "total" from "parliamentary_expenses" where ${clauses.join(' and ')}`,
        params,
      );
    return decimal(rows[0]?.total ?? '0');
  }
}
function page<T>(
  data: T[],
  query: { page: number; limit: number },
  total: number,
) {
  return {
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
function decimal(value: string): string {
  if (/^-?\d+\.\d{2}$/.test(value)) return value;
  if (/^-?\d+$/.test(value)) return `${value}.00`;
  throw new Error('Expense aggregate has an invalid decimal value');
}
