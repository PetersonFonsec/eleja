import { Candidacy } from '@eleja/database';
import { LoadStrategy, type FilterQuery } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CandidateListQueryDto } from './dto/candidate-list-query.dto.js';
import {
  toCandidateCard,
  toCandidateDetail,
  type CandidateCardDto,
  type CandidateDetailDto,
} from './dto/candidate-response.dto.js';

@Injectable()
export class CandidatesQueryService {
  constructor(
    @Inject(EntityManager)
    private readonly em: EntityManager,
  ) {}

  async list(query: CandidateListQueryDto): Promise<{
    data: CandidateCardDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where = buildFilter(query);
    const [entities, total] = await this.em.findAndCount(Candidacy, where, {
      populate: ['person', 'party', 'office', 'election'],
      strategy: LoadStrategy.JOINED,
      orderBy: { ballotName: 'ASC', id: 'ASC' },
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    });
    return {
      data: entities.map(toCandidateCard),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async detail(id: Candidacy['id']): Promise<CandidateDetailDto> {
    const entity = await this.em.findOne(
      Candidacy,
      { id },
      {
        populate: ['person', 'party', 'office', 'election'],
        strategy: LoadStrategy.JOINED,
      },
    );
    if (!entity) throw new NotFoundException('Candidate not found');
    return toCandidateDetail(entity);
  }
}

function buildFilter(query: CandidateListQueryDto): FilterQuery<Candidacy> {
  const where: FilterQuery<Candidacy> = {};
  if (query.year !== undefined) where.election = { year: query.year };
  if (query.office) where.office = { code: query.office };
  if (query.state) where.state = query.state;
  if (query.party) where.party = { acronym: query.party };
  if (query.name) {
    where.$or = [
      { person: { name: { $ilike: `%${query.name}%` } } },
      { ballotName: { $ilike: `%${query.name}%` } },
    ];
  }
  return where;
}
