import { describe, expect, it } from 'vitest';
import { readHistoricalYears } from '../src/historical-years.js';

describe('readHistoricalYears', () => {
  it('uses the supported general-election history by default', () => {
    expect(readHistoricalYears([])).toEqual([2014, 2018, 2022, 2026]);
  });

  it('accepts, deduplicates, and orders an explicit subset', () => {
    expect(readHistoricalYears(['--years=2022,2014,2022'])).toEqual([
      2014, 2022,
    ]);
  });

  it('rejects years outside the verified historical scope', () => {
    expect(() => readHistoricalYears(['--years=2016'])).toThrow(
      '--years must contain only 2014, 2018, 2022, 2026',
    );
  });
});
