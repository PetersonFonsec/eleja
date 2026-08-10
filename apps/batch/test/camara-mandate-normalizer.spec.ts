import { LegislativeBody, LegislativeMandateStatus } from '@eleja/database';
import { describe, expect, it } from 'vitest';
import { CamaraMandateNormalizer } from '../src/normalization/camara-mandate-normalizer.js';
import type { CamaraDeputyMandateRecord } from '../src/sources/camara/camara-deputy-mandate-record.js';

describe('CamaraMandateNormalizer', () => {
  const normalizer = new CamaraMandateNormalizer('2026-08-10');

  it('normalizes a current legislature with canonical fields', () => {
    const result = normalizer.normalize([
      record({ situation: null, occurredAt: '2023-02-01T00:00' }),
      record({ situation: 'Exercício', occurredAt: '2023-02-01T12:05' }),
    ]);
    expect(result).toEqual([
      {
        status: 'NORMALIZED',
        data: {
          personExternalId: '220593',
          mandate: {
            body: LegislativeBody.CHAMBER_OF_DEPUTIES,
            externalMandateId: null,
            legislatureNumber: 57,
            state: 'MT',
            partyAcronym: 'PL',
            startedAt: '2023-02-01',
            endedAt: null,
            status: LegislativeMandateStatus.ACTIVE,
            sourceStatus: 'Exercício',
          },
        },
      },
    ]);
  });

  it('normalizes nullable party, UF casing and completed status', () => {
    const result = normalizer.normalize([
      record({ state: 'sp', partyAcronym: null, situation: 'Exercício' }),
      record({
        state: 'sp',
        partyAcronym: null,
        situation: 'Vacância',
        occurredAt: '2025-01-01T00:00',
      }),
    ]);
    expect(result[0]).toMatchObject({
      status: 'NORMALIZED',
      data: {
        mandate: {
          state: 'SP',
          partyAcronym: null,
          endedAt: '2025-01-01',
          status: LegislativeMandateStatus.COMPLETED,
          sourceStatus: 'Vacância',
        },
      },
    });
  });

  it('maps unsupported official status to UNKNOWN and preserves it', () => {
    const result = normalizer.normalize([
      record({ situation: 'Exercício' }),
      record({ situation: 'Situação futura', occurredAt: '2025-01-01T00:00' }),
    ]);
    expect(result[0]).toMatchObject({
      status: 'NORMALIZED',
      data: {
        mandate: {
          status: LegislativeMandateStatus.UNKNOWN,
          sourceStatus: 'Situação futura',
        },
      },
    });
  });

  it('creates separate normalized mandates for multiple legislatures', () => {
    const result = normalizer.normalize([
      record({
        legislatureNumber: 56,
        legislatureStartedAt: '2019-02-01',
        legislatureEndedAt: '2023-01-31',
        situation: 'Exercício',
        occurredAt: '2019-02-01T10:00',
      }),
      record({ situation: 'Exercício' }),
    ]);
    expect(result).toHaveLength(2);
    expect(
      result.map(
        (item) =>
          item.status === 'NORMALIZED' && item.data.mandate.legislatureNumber,
      ),
    ).toEqual([56, 57]);
  });

  it('rejects invalid dates, UF and history without exercise', () => {
    const endedBeforeStart = normalizer.normalize([
      record({
        situation: 'Exercício',
        occurredAt: '2024-01-01T00:00',
        legislatureEndedAt: '2023-12-31',
      }),
    ]);
    expect(endedBeforeStart[0]).toMatchObject({ status: 'REJECTED' });

    expect(
      normalizer.normalize([
        record({ state: 'XX', situation: 'Exercício' }),
      ])[0],
    ).toMatchObject({
      status: 'REJECTED',
      issue: { reason: 'Mandate state is not a valid UF: XX' },
    });
    expect(
      normalizer.normalize([record({ situation: 'Licença' })])[0],
    ).toMatchObject({
      status: 'REJECTED',
      issue: { reason: 'Mandate history has no exercise entry' },
    });
  });
});

function record(
  overrides: Partial<CamaraDeputyMandateRecord> = {},
): CamaraDeputyMandateRecord {
  return {
    deputyExternalId: '220593',
    legislatureNumber: 57,
    state: 'MT',
    partyAcronym: 'PL',
    occurredAt: '2023-02-01T12:05',
    situation: 'Exercício',
    statusDescription: 'Entrada',
    legislatureStartedAt: '2023-02-01',
    legislatureEndedAt: '2027-01-31',
    ...overrides,
  };
}
