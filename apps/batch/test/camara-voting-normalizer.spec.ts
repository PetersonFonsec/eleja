import {
  LegislativeVotePosition,
  LegislativeVotingResult,
} from '@eleja/database';
import { describe, expect, it } from 'vitest';
import { CamaraDeputyVoteNormalizer } from '../src/normalization/camara-deputy-vote-normalizer.js';
import { CamaraVotingNormalizer } from '../src/normalization/camara-voting-normalizer.js';

describe('Câmara voting normalization', () => {
  it('normalizes official event fields without changing the local timestamp', () => {
    expect(
      new CamaraVotingNormalizer().normalize({
        externalId: '1-2',
        sourceUrl: 'https://official/1-2',
        date: '2025-07-01',
        registeredAt: '2025-07-01T16:14:29',
        description: ' Aprovado. ',
        approval: 1,
        proposalExternalId: '999',
      }),
    ).toEqual({
      status: 'NORMALIZED',
      issues: [],
      data: expect.objectContaining({
        externalId: '1-2',
        dateTime: new Date('2025-07-01T16:14:29Z'),
        description: 'Aprovado.',
        result: LegislativeVotingResult.APPROVED,
        sourceResult: '1',
        proposalExternalId: '999',
      }),
    });
  });

  it('rejects invalid identifiers, timestamps and proposal references', () => {
    const result = new CamaraVotingNormalizer().normalize({
      externalId: ' ',
      sourceUrl: 'x',
      date: 'x',
      registeredAt: 'bad',
      description: null,
      approval: null,
      proposalExternalId: 'PL-1',
    });
    expect(result.status).toBe('REJECTED');
    expect(result.issues.map((issue) => issue.reason)).toEqual([
      'Invalid voting external ID',
      'Invalid voting timestamp',
      'Malformed proposal reference',
    ]);
  });

  it.each([
    ['Sim', LegislativeVotePosition.YES],
    ['Não', LegislativeVotePosition.NO],
    ['Abstenção', LegislativeVotePosition.ABSTENTION],
    ['Obstrução', LegislativeVotePosition.OBSTRUCTION],
    ['Artigo 17', LegislativeVotePosition.OTHER],
  ])(
    'maps %s and preserves the source position',
    (sourcePosition, position) => {
      const result = new CamaraDeputyVoteNormalizer().normalize({
        votingExternalId: '1',
        deputyExternalId: '10',
        sourcePosition,
        registeredAt: '2025-01-01T12:00:00',
      });
      expect(result).toMatchObject({
        status: 'NORMALIZED',
        data: { position, sourcePosition },
      });
    },
  );

  it('rejects a vote without a usable deputy identity', () => {
    expect(
      new CamaraDeputyVoteNormalizer().normalize({
        votingExternalId: '1',
        deputyExternalId: null,
        sourcePosition: 'Sim',
        registeredAt: null,
      }).status,
    ).toBe('REJECTED');
  });
});
