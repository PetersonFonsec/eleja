export interface BatchLogger {
  log(message: string): void;
}

export interface DatabaseConnection {
  close(): Promise<void>;
}

export type InitializeDatabase = () => Promise<DatabaseConnection>;

export function runBatch(logger: BatchLogger = console): void {
  logger.log('Eleja batch started');
  logger.log('Eleja batch finished');
}

export async function executeBatch(
  initializeDatabase: InitializeDatabase,
  logger: BatchLogger = console,
): Promise<void> {
  const database = await initializeDatabase();

  try {
    runBatch(logger);
  } finally {
    await database.close();
  }
}
