import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CandidateAnalyticsFilters,
  CandidateDeclaredWealthHistory,
  CandidateLegislativeAnalyticsSummary,
  DeclaredWealthHistory,
  DeclaredWealthRankingItem,
  ElectionAnalyticsSummary,
  LatestMandateExpenseRankingItem,
} from './analytics.types.js';

const MAX_RANKING_LIMIT = 100;

@Injectable()
export class CandidateAnalyticsQueryService {
  constructor(@Inject(EntityManager) private readonly em: EntityManager) {}

  async getTopDeclaredWealthCandidates(
    filters: CandidateAnalyticsFilters,
    limit = 10,
  ): Promise<DeclaredWealthRankingItem[]> {
    const population = candidatePopulation(filters);
    const rows = await this.execute<WealthRow>(
      `select c.id as "candidacyId", c.person_id as "personId",
              c.ballot_name as "ballotName", p.name as "fullName",
              o.code as "officeCode", c.state, pa.acronym as "partyAcronym",
              sum(a.value)::text as "declaredWealth",
              count(a.id)::text as "assetCount"
         from candidacies c
         join elections e on e.id = c.election_id
         join people p on p.id = c.person_id
         join offices o on o.id = c.office_id
         join parties pa on pa.id = c.party_id
         join candidate_assets a on a.candidacy_id = c.id
        where ${population.sql}
        group by c.id, c.person_id, c.ballot_name, p.name, o.code, c.state, pa.acronym
        order by sum(a.value) desc, c.ballot_name asc, c.id asc
        limit ?`,
      [...population.params, rankingLimit(limit)],
    );
    return rows.map((row) => ({
      ...row,
      declaredWealth: decimal(row.declaredWealth),
      assetCount: count(row.assetCount),
    }));
  }

  async getTopCandidatesByLatestMandateExpenses(
    filters: CandidateAnalyticsFilters,
    limit = 10,
  ): Promise<LatestMandateExpenseRankingItem[]> {
    const population = candidatePopulation(filters);
    const rows = await this.execute<ExpenseRankingRow>(
      `with filtered_candidates as (
         select c.id, c.person_id, c.ballot_name, c.state,
                p.name as full_name, o.code as office_code, pa.acronym as party_acronym,
                row_number() over (partition by c.person_id order by c.ballot_name asc, c.id asc) as candidate_rank
           from candidacies c
           join elections e on e.id = c.election_id
           join people p on p.id = c.person_id
           join offices o on o.id = c.office_id
           join parties pa on pa.id = c.party_id
          where ${population.sql}
       ), latest_mandates as (
         select m.*,
                row_number() over (
                  partition by m.person_id
                  order by (m.status = 'ACTIVE') desc, m.started_at desc nulls last,
                           m.legislature_number desc nulls last, m.id asc
                ) as mandate_rank
           from legislative_mandates m
          where m.body = 'CHAMBER_OF_DEPUTIES'
            and m.person_id in (select person_id from filtered_candidates)
       )
       select fc.id as "candidacyId", fc.person_id as "personId",
              fc.ballot_name as "ballotName", fc.full_name as "fullName",
              fc.office_code as "officeCode", fc.state,
              fc.party_acronym as "partyAcronym", lm.id as "mandateId",
              lm.legislature_number::text as "legislatureNumber",
              lm.started_at::text as "startedAt", lm.ended_at::text as "endedAt",
              count(x.id)::text as "expenseCount",
              sum(x.net_value)::text as "totalNetValue"
         from filtered_candidates fc
         join latest_mandates lm on lm.person_id = fc.person_id and lm.mandate_rank = 1
         join parliamentary_expenses x on x.mandate_id = lm.id
        where fc.candidate_rank = 1
        group by fc.id, fc.person_id, fc.ballot_name, fc.full_name, fc.office_code,
                 fc.state, fc.party_acronym, lm.id, lm.legislature_number,
                 lm.started_at, lm.ended_at
        order by sum(x.net_value) desc, fc.ballot_name asc, fc.id asc
        limit ?`,
      [...population.params, rankingLimit(limit)],
    );
    return rows.map((row) => ({
      candidacyId: row.candidacyId,
      personId: row.personId,
      ballotName: row.ballotName,
      fullName: row.fullName,
      officeCode: row.officeCode,
      state: row.state,
      partyAcronym: row.partyAcronym,
      mandate: {
        id: row.mandateId,
        legislatureNumber:
          row.legislatureNumber === null ? null : count(row.legislatureNumber),
        startedAt: row.startedAt,
        endedAt: row.endedAt,
      },
      expenseCount: count(row.expenseCount),
      totalNetValue: decimal(row.totalNetValue),
    }));
  }

  async getDeclaredWealthHistoryByPerson(
    personId: string,
  ): Promise<DeclaredWealthHistory> {
    const exists = await this.execute<{ exists: boolean }>(
      'select exists(select 1 from people where id = ?) as "exists"',
      [personId],
    );
    if (!exists[0]?.exists) throw new NotFoundException('Person not found');
    const rows = await this.execute<HistoryRow>(
      `select c.id as "candidacyId", e.year::text as "electionYear",
              e.type as "electionType", o.code as "officeCode", c.state,
              count(a.id)::text as "assetCount", sum(a.value)::text as "declaredWealth"
         from candidacies c
         join elections e on e.id = c.election_id
         join offices o on o.id = c.office_id
         join candidate_assets a on a.candidacy_id = c.id
        where c.person_id = ?
        group by c.id, e.year, e.type, o.code, c.state
        order by e.year asc, e.type asc, c.id asc`,
      [personId],
    );
    return {
      personId,
      points: rows.map((row) => ({
        ...row,
        electionYear: count(row.electionYear),
        assetCount: count(row.assetCount),
        declaredWealth: decimal(row.declaredWealth),
      })),
    };
  }

  async getDeclaredWealthHistoryByCandidate(
    candidateId: string,
  ): Promise<CandidateDeclaredWealthHistory> {
    const rows = await this.execute<{ personId: string }>(
      'select person_id as "personId" from candidacies where id = ?',
      [candidateId],
    );
    const personId = rows[0]?.personId;
    if (!personId) throw new NotFoundException('Candidate not found');
    return {
      candidateId,
      ...(await this.getDeclaredWealthHistoryByPerson(personId)),
    };
  }

  async getElectionAnalyticsSummary(
    filters: CandidateAnalyticsFilters,
  ): Promise<ElectionAnalyticsSummary> {
    const population = candidatePopulation(filters);
    const [row] = await this.execute<SummaryRow>(
      `with population as (
         select c.id as candidacy_id, c.person_id
           from candidacies c
           join elections e on e.id = c.election_id
           join offices o on o.id = c.office_id
           join parties pa on pa.id = c.party_id
          where ${population.sql}
       ), people_population as (select distinct person_id from population)
       select
         (select count(*) from population)::text as "candidateCount",
         (select count(*) from people_population)::text as "personCount",
         (select count(*) from population p where exists
           (select 1 from candidate_assets a where a.candidacy_id = p.candidacy_id))::text as "withAssets",
         (select count(*) from people_population p where exists
           (select 1 from legislative_mandates m where m.person_id = p.person_id and m.body = 'CHAMBER_OF_DEPUTIES'))::text as "withMandates",
         (select count(*) from people_population p where exists
           (select 1 from person_external_identities i where i.person_id = p.person_id and i.source = 'CAMARA'))::text as "withCamaraIdentity",
         (select count(*) from people_population p where exists
           (select 1 from legislative_proposal_authors a where a.person_id = p.person_id))::text as "withProposals",
         (select count(*) from people_population p where exists
           (select 1 from legislative_votes v where v.person_id = p.person_id))::text as "withVotes",
         (select count(*) from people_population p where exists
           (select 1 from parliamentary_expenses x where x.person_id = p.person_id))::text as "withExpenses",
         (select count(*) from people_population p where
           (select count(distinct a.candidacy_id) from candidacies hc
             join candidate_assets a on a.candidacy_id = hc.id where hc.person_id = p.person_id) >= 2)::text as "withHistoricalAssetSeries",
         (select count(*) from people_population p where
           (select count(*) from candidacies hc where hc.person_id = p.person_id) >= 2)::text as "multipleHistoricalCandidacies"`,
      population.params,
    );
    if (!row) throw new Error('Election analytics summary returned no row');
    return {
      candidateCount: count(row.candidateCount),
      personCount: count(row.personCount),
      candidatesWithDeclaredAssets: count(row.withAssets),
      personsWithLegislativeHistory: count(row.withMandates),
      personsWithMultipleHistoricalCandidacies: count(
        row.multipleHistoricalCandidacies,
      ),
      coverage: {
        withAssets: count(row.withAssets),
        withHistoricalAssetSeries: count(row.withHistoricalAssetSeries),
        withCamaraIdentity: count(row.withCamaraIdentity),
        withMandates: count(row.withMandates),
        withProposals: count(row.withProposals),
        withVotes: count(row.withVotes),
        withExpenses: count(row.withExpenses),
      },
    };
  }

  async getLegislativeAnalyticsSummary(
    filters: CandidateAnalyticsFilters,
  ): Promise<CandidateLegislativeAnalyticsSummary> {
    const population = candidatePopulation(filters);
    const [row] = await this.execute<LegislativeSummaryRow>(
      `with people_population as (
         select distinct c.person_id
           from candidacies c
           join elections e on e.id = c.election_id
           join offices o on o.id = c.office_id
           join parties pa on pa.id = c.party_id
          where ${population.sql}
       )
       select
         (select count(*) from people_population)::text as "personCount",
         (select count(*) from legislative_mandates m join people_population p on p.person_id = m.person_id
           where m.body = 'CHAMBER_OF_DEPUTIES')::text as "totalMandates",
         (select count(*) from legislative_proposal_authors a join people_population p on p.person_id = a.person_id)::text as "proposalAuthorshipCount",
         (select count(distinct a.proposal_id) from legislative_proposal_authors a join people_population p on p.person_id = a.person_id)::text as "uniqueProposalCount",
         (select count(*) from legislative_proposal_authors a join people_population p on p.person_id = a.person_id
           where a.is_primary_author = true)::text as "primaryAuthorshipCount",
         (select count(*) from legislative_votes v join people_population p on p.person_id = v.person_id)::text as "individualVoteCount",
         (select count(*) from parliamentary_expenses x join people_population p on p.person_id = x.person_id)::text as "expenseRecordCount",
         coalesce((select sum(x.net_value) from parliamentary_expenses x join people_population p on p.person_id = x.person_id), 0)::text as "expenseTotalNetValue"`,
      population.params,
    );
    if (!row) throw new Error('Legislative analytics summary returned no row');
    return {
      personCount: count(row.personCount),
      totalMandates: count(row.totalMandates),
      proposalAuthorshipCount: count(row.proposalAuthorshipCount),
      uniqueProposalCount: count(row.uniqueProposalCount),
      primaryAuthorshipCount: count(row.primaryAuthorshipCount),
      individualVoteCount: count(row.individualVoteCount),
      expenseRecordCount: count(row.expenseRecordCount),
      expenseTotalNetValue: decimal(row.expenseTotalNetValue),
    };
  }

  private execute<T>(sql: string, params: unknown[]): Promise<T[]> {
    return this.em.getConnection().execute<T[]>(sql, params);
  }
}

function candidatePopulation(filters: CandidateAnalyticsFilters): {
  sql: string;
  params: unknown[];
} {
  if (
    !Number.isSafeInteger(filters.electionYear) ||
    filters.electionYear < 1900
  )
    throw new Error('Analytics election year is invalid');
  const clauses = ['e.year = ?'];
  const params: unknown[] = [filters.electionYear];
  if (filters.officeCode) {
    clauses.push('o.code = ?');
    params.push(filters.officeCode);
  }
  if (filters.state) {
    clauses.push('c.state = ?');
    params.push(filters.state);
  }
  if (filters.partyAcronym) {
    clauses.push('pa.acronym = ?');
    params.push(filters.partyAcronym);
  }
  return { sql: clauses.join(' and '), params };
}

function rankingLimit(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_RANKING_LIMIT)
    throw new Error('Analytics ranking limit must be between 1 and 100');
  return value;
}

function count(value: string): number {
  if (!/^\d+$/.test(value)) throw new Error('Analytics count is invalid');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed))
    throw new Error('Analytics count is unsafe');
  return parsed;
}

function decimal(value: string): string {
  if (/^-?\d+\.\d{2}$/.test(value)) return value;
  if (/^-?\d+$/.test(value)) return `${value}.00`;
  throw new Error('Analytics monetary aggregate is invalid');
}

interface WealthRow extends Omit<DeclaredWealthRankingItem, 'assetCount'> {
  assetCount: string;
}
interface ExpenseRankingRow {
  candidacyId: string;
  personId: string;
  ballotName: string;
  fullName: string;
  officeCode: string;
  state: string | null;
  partyAcronym: string | null;
  mandateId: string;
  legislatureNumber: string | null;
  startedAt: string | null;
  endedAt: string | null;
  expenseCount: string;
  totalNetValue: string;
}
interface HistoryRow {
  candidacyId: string;
  electionYear: string;
  electionType: string;
  officeCode: string;
  state: string | null;
  assetCount: string;
  declaredWealth: string;
}
interface SummaryRow {
  candidateCount: string;
  personCount: string;
  withAssets: string;
  withMandates: string;
  withCamaraIdentity: string;
  withProposals: string;
  withVotes: string;
  withExpenses: string;
  withHistoricalAssetSeries: string;
  multipleHistoricalCandidacies: string;
}
interface LegislativeSummaryRow {
  personCount: string;
  totalMandates: string;
  proposalAuthorshipCount: string;
  uniqueProposalCount: string;
  primaryAuthorshipCount: string;
  individualVoteCount: string;
  expenseRecordCount: string;
  expenseTotalNetValue: string;
}
