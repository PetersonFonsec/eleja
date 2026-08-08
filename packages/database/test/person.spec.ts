import { describe, expect, it } from 'vitest';
import { Person } from '../src/entities/person.entity.js';

const createdAt = new Date('2026-08-08T12:00:00.000Z');

describe('Person', () => {
  it('creates a valid person', () => {
    const birthDate = '1980-05-10';
    const person = new Person(
      'Maria da Silva',
      birthDate,
      'Feminino',
      'Ensino superior completo',
      'Professora',
      createdAt,
    );

    expect(person.name).toBe('Maria da Silva');
    expect(person.birthDate).toEqual(birthDate);
    expect(person.gender).toBe('Feminino');
    expect(person.education).toBe('Ensino superior completo');
    expect(person.occupation).toBe('Professora');
  });

  it('requires a name', () => {
    expect(() => new Person(' ')).toThrow('Person name must not be empty');
  });

  it('rejects a future birth date', () => {
    const futureBirthDate = '2026-08-09';

    expect(
      () =>
        new Person(
          'Maria da Silva',
          futureBirthDate,
          null,
          null,
          null,
          createdAt,
        ),
    ).toThrow('Person birth date cannot be in the future');
  });

  it('rejects an invalid calendar birth date', () => {
    expect(
      () =>
        new Person('Maria da Silva', '2026-02-30', null, null, null, createdAt),
    ).toThrow('Person birth date must use a valid YYYY-MM-DD date');
  });

  it('allows optional demographic fields to be absent', () => {
    const person = new Person(
      'Maria da Silva',
      null,
      null,
      null,
      null,
      createdAt,
    );

    expect(person.birthDate).toBeNull();
    expect(person.gender).toBeNull();
    expect(person.education).toBeNull();
    expect(person.occupation).toBeNull();
  });
});
