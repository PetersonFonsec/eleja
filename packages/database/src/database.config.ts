import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { resolve } from 'node:path';

export const DEFAULT_DATABASE_URL =
  'postgresql://eleja:eleja@localhost:5432/eleja';

const packageRoot = resolve(__dirname, '..');

export function createMikroOrmOptions(
  databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
) {
  return defineConfig({
    clientUrl: databaseUrl,
    entities: [],
    discovery: {
      warnWhenNoEntities: false,
    },
    extensions: [Migrator],
    migrations: {
      path: resolve(packageRoot, 'dist/migrations'),
      pathTs: resolve(packageRoot, 'src/migrations'),
      transactional: true,
      allOrNothing: true,
    },
  });
}
