import { describe, expect, it, vi } from 'vitest';
import { executeBatch, runBatch } from '../src/batch.js';

describe('batch bootstrap', () => {
  it('logs its start and successful completion', () => {
    const log = vi.fn();

    runBatch({ log });

    expect(log.mock.calls).toEqual([
      ['Eleja batch started'],
      ['Eleja batch finished'],
    ]);
  });
});

describe('executeBatch', () => {
  it('initializes and closes the database connection', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const initializeDatabase = vi.fn().mockResolvedValue({ close });
    const log = vi.fn();

    await executeBatch(initializeDatabase, { log });

    expect(initializeDatabase).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
