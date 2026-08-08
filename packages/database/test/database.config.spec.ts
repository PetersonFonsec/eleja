import { describe, expect, it } from 'vitest';
import {
  createMikroOrmOptions,
  DEFAULT_DATABASE_URL,
} from '../src/database.config.js';
import { BatchRun } from '../src/entities/batch-run.entity.js';
import { DatasetVersion } from '../src/entities/dataset-version.entity.js';
import { Election } from '../src/entities/election.entity.js';
import { Office } from '../src/entities/office.entity.js';
import { Party } from '../src/entities/party.entity.js';
import { Person } from '../src/entities/person.entity.js';
import { Candidacy } from '../src/entities/candidacy.entity.js';
import { CandidateSource } from '../src/entities/candidate-source.entity.js';
import { CandidateAsset } from '../src/entities/candidate-asset.entity.js';
import { CandidateAssetSource } from '../src/entities/candidate-asset-source.entity.js';

describe('createMikroOrmOptions', () => {
  it('creates PostgreSQL options from the supplied connection URL', () => {
    const options = createMikroOrmOptions(DEFAULT_DATABASE_URL);

    expect(options.clientUrl).toBe(DEFAULT_DATABASE_URL);
    expect(options.entities).toEqual([
      DatasetVersion,
      BatchRun,
      Election,
      Party,
      Office,
      Person,
      Candidacy,
      CandidateSource,
      CandidateAsset,
      CandidateAssetSource,
    ]);
    expect(options.migrations?.transactional).toBe(true);
    expect(options.migrations?.allOrNothing).toBe(true);
  });
});
