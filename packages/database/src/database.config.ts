import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { resolve } from 'node:path';
import { BatchRun } from './entities/batch-run.entity.js';
import { DatasetVersion } from './entities/dataset-version.entity.js';
import { Election } from './entities/election.entity.js';
import { Office } from './entities/office.entity.js';
import { Party } from './entities/party.entity.js';
import { Person } from './entities/person.entity.js';
import { Candidacy } from './entities/candidacy.entity.js';

export const DEFAULT_DATABASE_URL =
  'postgresql://eleja:eleja@localhost:5432/eleja';

const packageRoot = resolve(__dirname, '..');

export function createMikroOrmOptions(
  databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
) {
  return defineConfig({
    clientUrl: databaseUrl,
    entities: [
      DatasetVersion,
      BatchRun,
      Election,
      Party,
      Office,
      Person,
      Candidacy,
    ],
    extensions: [Migrator],
    migrations: {
      path: resolve(packageRoot, 'dist/migrations'),
      pathTs: resolve(packageRoot, 'src/migrations'),
      transactional: true,
      allOrNothing: true,
    },
  });
}
