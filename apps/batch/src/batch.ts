export interface BatchLogger {
  log(message: string): void;
}

export function runBatch(logger: BatchLogger = console): void {
  logger.log('Eleja batch started');
  logger.log('Eleja batch finished');
}
