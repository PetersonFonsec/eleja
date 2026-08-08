import { describe, expect, it } from 'vitest';
import { Election } from '../src/entities/election.entity.js';
import { ElectionType } from '../src/entities/election-type.js';

describe('Election', () => {
  it('creates a valid election', () => {
    const startDate = new Date('2026-10-04T00:00:00.000Z');
    const election = new Election(2026, ElectionType.GENERAL, 1, startDate);

    expect(election.year).toBe(2026);
    expect(election.type).toBe(ElectionType.GENERAL);
    expect(election.round).toBe(1);
    expect(election.startDate).toEqual(startDate);
  });

  it.each([1, 2] as const)('accepts round %i', (round) => {
    const election = new Election(2026, ElectionType.GENERAL, round);

    expect(election.round).toBe(round);
  });

  it.each([0, 1799, 10_000, 2026.5])('rejects invalid year %s', (year) => {
    expect(() => new Election(year, ElectionType.GENERAL)).toThrow(
      'Election year must be an integer between 1800 and 9999',
    );
  });

  it.each([0, 3, -1])('rejects invalid round %s', (round) => {
    expect(
      () => new Election(2026, ElectionType.GENERAL, round as 1 | 2),
    ).toThrow('Election round must be 1, 2, or null');
  });
});
