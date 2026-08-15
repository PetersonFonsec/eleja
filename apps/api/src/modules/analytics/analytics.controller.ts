import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { CandidateAnalyticsQueryService } from './candidate-analytics-query.service.js';
import {
  AnalyticsFilterQueryPipe,
  AnalyticsRankingQueryPipe,
  toAnalyticsFilters,
  type AnalyticsFilterQueryDto,
  type AnalyticsRankingQueryDto,
} from './dto/analytics-query.dto.js';
import {
  coverageResponse,
  expenseRankingResponse,
  legislativeResponse,
  summaryResponse,
  wealthHistoryResponse,
  wealthRankingResponse,
} from './dto/analytics-response.dto.js';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    @Inject(CandidateAnalyticsQueryService)
    private readonly queries: CandidateAnalyticsQueryService,
  ) {}

  @Get('summary')
  async summary(
    @Query(AnalyticsFilterQueryPipe) query: AnalyticsFilterQueryDto,
  ) {
    return summaryResponse(
      query,
      await this.queries.getElectionAnalyticsSummary(toAnalyticsFilters(query)),
    );
  }

  @Get('rankings/declared-wealth')
  async declaredWealth(
    @Query(AnalyticsRankingQueryPipe) query: AnalyticsRankingQueryDto,
  ) {
    return wealthRankingResponse(
      query,
      await this.queries.getTopDeclaredWealthCandidates(
        toAnalyticsFilters(query),
        query.limit,
      ),
    );
  }

  @Get('rankings/parliamentary-expenses')
  async parliamentaryExpenses(
    @Query(AnalyticsRankingQueryPipe) query: AnalyticsRankingQueryDto,
  ) {
    return expenseRankingResponse(
      query,
      await this.queries.getTopCandidatesByLatestMandateExpenses(
        toAnalyticsFilters(query),
        query.limit,
      ),
    );
  }

  @Get('candidates/:id/wealth-history')
  async wealthHistory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return wealthHistoryResponse(
      await this.queries.getDeclaredWealthHistoryByCandidate(id),
    );
  }

  @Get('legislative')
  async legislative(
    @Query(AnalyticsFilterQueryPipe) query: AnalyticsFilterQueryDto,
  ) {
    const filters = toAnalyticsFilters(query);
    const [coverage, analytics] = await Promise.all([
      this.queries.getElectionAnalyticsSummary(filters),
      this.queries.getLegislativeAnalyticsSummary(filters),
    ]);
    return legislativeResponse(query, coverage, analytics);
  }

  @Get('coverage')
  async coverage(
    @Query(AnalyticsFilterQueryPipe) query: AnalyticsFilterQueryDto,
  ) {
    return coverageResponse(
      query,
      await this.queries.getElectionAnalyticsSummary(toAnalyticsFilters(query)),
    );
  }
}
