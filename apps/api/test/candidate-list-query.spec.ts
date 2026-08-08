import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CandidateListQueryPipe } from '../src/modules/candidates/dto/candidate-list-query.dto.js';

describe('CandidateListQueryPipe', () => {
  const pipe = new CandidateListQueryPipe();

  it('applies defaults and normalizes canonical filters', () => {
    expect(
      pipe.transform({ state: 'sp', party: 'pt', office: 'governor' }),
    ).toEqual({
      page: 1,
      limit: 20,
      state: 'SP',
      party: 'PT',
      office: 'GOVERNOR',
    });
  });

  it.each([
    [{ page: '0' }],
    [{ page: '-1' }],
    [{ limit: '0' }],
    [{ limit: '999999' }],
    [{ year: 'abc' }],
    [{ state: 'XX' }],
  ])('rejects invalid query %j', (query) => {
    expect(() => pipe.transform(query)).toThrow(BadRequestException);
  });
});
