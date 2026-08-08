import { describe, expect, it } from 'vitest';
import { Office } from '../src/entities/office.entity.js';
import { OfficeScope } from '../src/entities/office-scope.js';

describe('Office', () => {
  it('creates a valid office', () => {
    const office = new Office(
      'PRESIDENT',
      'Presidente da República',
      OfficeScope.NATIONAL,
      '1',
    );

    expect(office.code).toBe('PRESIDENT');
    expect(office.name).toBe('Presidente da República');
    expect(office.scope).toBe(OfficeScope.NATIONAL);
    expect(office.sourceCode).toBe('1');
  });

  it('requires a canonical code', () => {
    expect(() => new Office(' ', 'Presidente', OfficeScope.NATIONAL)).toThrow(
      'Office code must not be empty',
    );
  });

  it('requires a name', () => {
    expect(() => new Office('PRESIDENT', ' ', OfficeScope.NATIONAL)).toThrow(
      'Office name must not be empty',
    );
  });

  it('requires a valid scope', () => {
    expect(
      () => new Office('PRESIDENT', 'Presidente', undefined as never),
    ).toThrow('Office scope is invalid');
  });
});
