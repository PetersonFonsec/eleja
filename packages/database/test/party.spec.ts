import { describe, expect, it } from 'vitest';
import { Party } from '../src/entities/party.entity.js';

describe('Party', () => {
  it('creates a valid party', () => {
    const party = new Party(
      'Partido Exemplo Brasileiro',
      'PEB',
      42,
      'party-42',
    );

    expect(party.name).toBe('Partido Exemplo Brasileiro');
    expect(party.acronym).toBe('PEB');
    expect(party.number).toBe(42);
    expect(party.sourcePartyId).toBe('party-42');
  });

  it('requires a name', () => {
    expect(() => new Party('  ', 'PEB')).toThrow(
      'Party name must not be empty',
    );
  });

  it('requires an acronym', () => {
    expect(() => new Party('Partido Exemplo Brasileiro', '  ')).toThrow(
      'Party acronym must not be empty',
    );
  });

  it.each([-1, 0, 1.5])('rejects invalid electoral number %s', (number) => {
    expect(
      () => new Party('Partido Exemplo Brasileiro', 'PEB', number),
    ).toThrow('Party number must be a positive integer or null');
  });
});
