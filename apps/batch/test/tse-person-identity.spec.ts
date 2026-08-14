import { describe, expect, it } from 'vitest';
import {
  fingerprintTseCpf,
  normalizeBirthState,
  normalizeIdentityName,
  tseCpfExternalId,
} from '../src/identity/tse-person-identity.js';

describe('TSE person identity material', () => {
  it('creates a deterministic source-scoped fingerprint without retaining the CPF', () => {
    const fingerprint = fingerprintTseCpf('12345678901');

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprintTseCpf(' 12345678901 ')).toBe(fingerprint);
    expect(tseCpfExternalId(fingerprint!)).toBe(`cpf-sha256:${fingerprint}`);
    expect(tseCpfExternalId(fingerprint!)).not.toContain('12345678901');
  });

  it.each(['', '-1', '#NULO', '00000000000', '123'])(
    'does not fingerprint invalid stable identity material %j',
    (value) => expect(fingerprintTseCpf(value)).toBeNull(),
  );

  it('normalizes names deterministically without fuzzy or accent removal', () => {
    expect(normalizeIdentityName('  João   da Silva ')).toBe('JOÃO DA SILVA');
    expect(normalizeIdentityName('Joao da Silva')).not.toBe(
      normalizeIdentityName('João da Silva'),
    );
  });

  it('accepts only official two-letter birth states', () => {
    expect(normalizeBirthState(' sp ')).toBe('SP');
    expect(normalizeBirthState('XX')).toBeNull();
  });
});
