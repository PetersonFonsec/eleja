import { describe, expect, it } from 'vitest';
import {
  createMikroOrmOptions,
  DEFAULT_DATABASE_URL,
} from '../src/database.config.js';
import { BatchRun } from '../src/entities/batch-run.entity.js';
import { DatasetVersion } from '../src/entities/dataset-version.entity.js';

describe('createMikroOrmOptions', () => {
  it('creates PostgreSQL options from the supplied connection URL', () => {
    const options = createMikroOrmOptions(DEFAULT_DATABASE_URL);

    expect(options.clientUrl).toBe(DEFAULT_DATABASE_URL);
    expect(options.entities).toEqual([DatasetVersion, BatchRun]);
    expect(options.migrations?.transactional).toBe(true);
    expect(options.migrations?.allOrNothing).toBe(true);
  });
});
