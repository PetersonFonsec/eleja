import { describe, expect, it } from 'vitest';
import {
  createMikroOrmOptions,
  DEFAULT_DATABASE_URL,
} from '../src/database.config.js';

describe('createMikroOrmOptions', () => {
  it('creates PostgreSQL options from the supplied connection URL', () => {
    const options = createMikroOrmOptions(DEFAULT_DATABASE_URL);

    expect(options.clientUrl).toBe(DEFAULT_DATABASE_URL);
    expect(options.entities).toEqual([]);
    expect(options.migrations?.transactional).toBe(true);
    expect(options.migrations?.allOrNothing).toBe(true);
  });
});
