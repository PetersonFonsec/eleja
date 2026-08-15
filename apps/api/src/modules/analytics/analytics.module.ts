import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller.js';
import { CandidateAnalyticsQueryService } from './candidate-analytics-query.service.js';
import {
  AnalyticsFilterQueryPipe,
  AnalyticsRankingQueryPipe,
} from './dto/analytics-query.dto.js';

@Module({
  controllers: [AnalyticsController],
  providers: [
    CandidateAnalyticsQueryService,
    AnalyticsFilterQueryPipe,
    AnalyticsRankingQueryPipe,
  ],
})
export class AnalyticsModule {}
