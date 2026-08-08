import { MikroORM } from '@mikro-orm/postgresql';
import { createMikroOrmOptions } from './database.config.js';

export function initializeDatabase() {
  return MikroORM.init(createMikroOrmOptions());
}
