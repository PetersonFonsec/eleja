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
import {
  CandidateListQueryPipe,
  type CandidateListQueryDto,
} from './dto/candidate-list-query.dto.js';

@Controller('candidates')
export class CandidatesController {
  constructor(
    @Inject(CandidatesQueryService)
    private readonly queries: CandidatesQueryService,
    @Inject(CandidateAssetsQueryService)
    private readonly assetQueries: CandidateAssetsQueryService,
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
}
