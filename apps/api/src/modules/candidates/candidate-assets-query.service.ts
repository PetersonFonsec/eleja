import { CandidateAsset, Candidacy } from '@eleja/database';
import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  toCandidateAssetsResponse,
  type CandidateAssetsResponseDto,
} from './dto/candidate-assets-response.dto.js';

interface AssetAggregateRow {
  totalAssets: number;
  totalDeclaredValue: string;
}

@Injectable()
export class CandidateAssetsQueryService {
  constructor(
    @Inject(EntityManager)
    private readonly em: EntityManager,
  ) {}

  async list(
    candidateId: Candidacy['id'],
  ): Promise<CandidateAssetsResponseDto> {
    const exists = await this.em.count(Candidacy, { id: candidateId });
    if (exists === 0) throw new NotFoundException('Candidate not found');

    const [assets, aggregateRows] = await Promise.all([
      this.em.find(
        CandidateAsset,
        { candidacy: candidateId },
        { orderBy: { value: 'DESC', id: 'ASC' } },
      ),
      this.em.getConnection().execute<AssetAggregateRow[]>(
        `select count(*)::int as "totalAssets",
                coalesce(sum("value"), 0)::text as "totalDeclaredValue"
           from "candidate_assets"
          where "candidacy_id" = ?`,
        [candidateId],
      ),
    ]);
    const aggregate = aggregateRows[0];
    if (!aggregate)
      throw new Error('Candidate asset aggregate was not returned');
    return toCandidateAssetsResponse(candidateId, assets, {
      totalAssets: aggregate.totalAssets,
      totalDeclaredValue: normalizeDecimal(aggregate.totalDeclaredValue),
    });
  }
}

function normalizeDecimal(value: string): string {
  if (/^-?\d+\.\d{2}$/.test(value)) return value;
  if (/^-?\d+$/.test(value)) return `${value}.00`;
  throw new Error('Candidate asset aggregate has an invalid decimal value');
}
