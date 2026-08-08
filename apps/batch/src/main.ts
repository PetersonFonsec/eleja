import { initializeDatabase } from '@eleja/database';
import { executeBatch } from './batch.js';

executeBatch(initializeDatabase).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
