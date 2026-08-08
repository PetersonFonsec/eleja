import { describe, expect, it, vi } from 'vitest';
import { runBatch } from '../src/batch.js';

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
