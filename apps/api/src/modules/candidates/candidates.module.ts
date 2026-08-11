import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller.js';
import { CandidatesQueryService } from './candidates-query.service.js';
import { CandidateListQueryPipe } from './dto/candidate-list-query.dto.js';
import { CandidateAssetsQueryService } from './candidate-assets-query.service.js';
import { CandidateLegislativeQueryService } from './candidate-legislative-query.service.js';
import {
  ExpenseQueryPipe,
  ProposalQueryPipe,
  VoteQueryPipe,
} from './dto/legislative-query.dto.js';

@Module({
  controllers: [CandidatesController],
  providers: [
    CandidatesQueryService,
    CandidateAssetsQueryService,
    CandidateListQueryPipe,
    CandidateLegislativeQueryService,
    ProposalQueryPipe,
    VoteQueryPipe,
    ExpenseQueryPipe,
  ],
})
export class CandidatesModule {}
