export interface ProcessingCounters {
  recordsRead: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsRejected: number;
}

export function assertValidCounters(counters: ProcessingCounters): void {
  for (const [name, value] of Object.entries(counters)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${name} must be a non-negative safe integer`);
    }
  }
}
