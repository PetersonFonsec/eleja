import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import type { Candidacy } from '@eleja/database';
import { CandidatesQueryService } from './candidates-query.service.js';
import { CandidateAssetsQueryService } from './candidate-assets-query.service.js';
import { CandidateLegislativeQueryService } from './candidate-legislative-query.service.js';
import {
  CandidateListQueryPipe,
  type CandidateListQueryDto,
} from './dto/candidate-list-query.dto.js';
import {
  ExpenseQueryPipe,
  ProposalQueryPipe,
  VoteQueryPipe,
  type ExpenseQuery,
  type ProposalQuery,
  type VoteQuery,
} from './dto/legislative-query.dto.js';

@Controller('candidates')
export class CandidatesController {
  constructor(
    @Inject(CandidatesQueryService)
    private readonly queries: CandidatesQueryService,
    @Inject(CandidateAssetsQueryService)
    private readonly assetQueries: CandidateAssetsQueryService,
    @Inject(CandidateLegislativeQueryService)
    private readonly legislativeQueries: CandidateLegislativeQueryService,
  ) {}

  @Get()
  list(@Query(CandidateListQueryPipe) query: CandidateListQueryDto) {
    return this.queries.list(query);
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.queries.detail(id as Candidacy['id']);
  }

  @Get(':id/assets')
  assets(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.assetQueries.list(id as Candidacy['id']);
  }

  @Get(':id/legislative-profile')
  legislativeProfile(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.legislativeQueries.profile(id as Candidacy['id']);
  }

  @Get(':id/mandates')
  mandates(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.legislativeQueries.mandates(id as Candidacy['id']);
  }

  @Get(':id/proposals')
  proposals(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query(ProposalQueryPipe) query: ProposalQuery,
  ) {
    return this.legislativeQueries.proposals(id as Candidacy['id'], query);
  }

  @Get(':id/votes')
  votes(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query(VoteQueryPipe) query: VoteQuery,
  ) {
    return this.legislativeQueries.votes(id as Candidacy['id'], query);
  }

  @Get(':id/expenses')
  expenses(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query(ExpenseQueryPipe) query: ExpenseQuery,
  ) {
    return this.legislativeQueries.expenses(id as Candidacy['id'], query);
  }
}
