import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller.js';
import { CandidatesQueryService } from './candidates-query.service.js';
import { CandidateListQueryPipe } from './dto/candidate-list-query.dto.js';

@Module({
  controllers: [CandidatesController],
  providers: [CandidatesQueryService, CandidateListQueryPipe],
})
export class CandidatesModule {}
