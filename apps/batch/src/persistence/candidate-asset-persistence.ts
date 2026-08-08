import {
  CandidateAsset,
  CandidateAssetSource,
  Candidacy,
  initializeDatabase,
} from '@eleja/database';
import type { NormalizedCandidateAssetData } from '../normalization/normalized-candidate-asset-data.js';
import type { CandidateAssetImportContext } from './candidate-asset-import-context.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;

export type CandidateAssetPersistenceResult =
  | {
      status: 'INSERTED' | 'UPDATED' | 'UNCHANGED';
      sourceStatus: 'INSERTED' | 'UPDATED' | 'UNCHANGED';
      asset: CandidateAsset;
    }
  | {
      status: 'REJECTED';
      code: 'CANDIDACY_NOT_FOUND';
      sourceCandidateId: string;
    };

export class CandidateAssetPersistenceService {
  private readonly candidacyIds = new Map<string, Candidacy['id'] | null>();
  constructor(private readonly orm: Database) {}

  async persist(
    data: NormalizedCandidateAssetData,
    context: CandidateAssetImportContext,
  ): Promise<CandidateAssetPersistenceResult> {
    return this.orm.em.transactional(async (em) => {
      let candidacyId = this.candidacyIds.get(data.sourceCandidateId);
      if (candidacyId === undefined) {
        candidacyId =
          (
            await em.findOne(Candidacy, {
              sourceCandidateId: data.sourceCandidateId,
            })
          )?.id ?? null;
        this.candidacyIds.set(data.sourceCandidateId, candidacyId);
      }
      if (candidacyId === null) {
        return {
          status: 'REJECTED',
          code: 'CANDIDACY_NOT_FOUND',
          sourceCandidateId: data.sourceCandidateId,
        };
      }
      const candidacy = em.getReference(Candidacy, candidacyId);
      let asset = await em.findOne(CandidateAsset, {
        candidacy,
        sourceSequence: data.asset.sourceSequence,
      });
      let status: 'INSERTED' | 'UPDATED' | 'UNCHANGED' = 'UNCHANGED';
      if (!asset) {
        asset = new CandidateAsset(
          candidacy,
          data.asset.sourceSequence,
          data.asset.typeCode,
          data.asset.type,
          data.asset.description,
          data.asset.value,
        );
        em.persist(asset);
        status = 'INSERTED';
      } else {
        const changed =
          assign(asset, 'typeCode', data.asset.typeCode) |
          assign(asset, 'type', data.asset.type) |
          assign(asset, 'description', data.asset.description) |
          assign(asset, 'value', data.asset.value);
        if (changed) status = 'UPDATED';
      }
      const sourceIdentifier = `${data.sourceCandidateId}:${data.asset.sourceSequence}`;
      let source = await em.findOne(CandidateAssetSource, {
        candidateAsset: asset,
        rawChecksum: context.rawChecksum,
        sourceIdentifier,
      });
      let sourceStatus: 'INSERTED' | 'UPDATED' | 'UNCHANGED' = 'UNCHANGED';
      if (!source) {
        source = new CandidateAssetSource(
          asset,
          context.sourceType,
          context.sourceName,
          sourceIdentifier,
          context.rawStorageKey,
          context.rawChecksum,
          { sourceUrl: context.sourceUrl, importedAt: context.importedAt },
        );
        em.persist(source);
        sourceStatus = 'INSERTED';
      } else if (context.importedAt > source.lastCheckedAt) {
        source.lastCheckedAt = context.importedAt;
        sourceStatus = 'UPDATED';
      }
      return { status, sourceStatus, asset };
    });
  }
}

function assign<T extends object, K extends keyof T>(
  entity: T,
  key: K,
  value: T[K],
): number {
  if (entity[key] === value) return 0;
  entity[key] = value;
  return 1;
}
