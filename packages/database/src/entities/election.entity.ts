import {
  Entity,
  Enum,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { ElectionType } from './election-type.js';

@Entity({ tableName: 'elections' })
@Unique({
  name: 'elections_year_type_round_unique',
  properties: ['year', 'type', 'round'],
  where: 'round is not null',
})
@Unique({
  name: 'elections_year_type_without_round_unique',
  properties: ['year', 'type'],
  where: 'round is null',
})
export class Election {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @Property({ type: 'integer' })
  year: number;

  @Enum({ items: () => ElectionType })
  type: ElectionType;

  @Property({ type: 'smallint', nullable: true })
  round: 1 | 2 | null;

  @Property({ type: 'date', nullable: true })
  startDate: Date | null;

  @Property({ type: 'timestamptz' })
  createdAt: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    year: number,
    type: ElectionType,
    round: 1 | 2 | null = null,
    startDate: Date | null = null,
    createdAt = new Date(),
  ) {
    if (!Number.isSafeInteger(year) || year < 1800 || year > 9999) {
      throw new Error('Election year must be an integer between 1800 and 9999');
    }
    if (!Object.values(ElectionType).includes(type)) {
      throw new Error('Election type is invalid');
    }
    if (round !== null && round !== 1 && round !== 2) {
      throw new Error('Election round must be 1, 2, or null');
    }

    this.year = year;
    this.type = type;
    this.round = round;
    this.startDate = startDate;
    this.createdAt = createdAt;
    this.updatedAt = createdAt;
  }
}
