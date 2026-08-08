import {
  Entity,
  Enum,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { OfficeScope } from './office-scope.js';

@Entity({ tableName: 'offices' })
export class Office {
  @PrimaryKey({ type: 'uuid' })
  id = randomUUID();

  @Property({ type: 'string', length: 100, nullable: true, unique: true })
  sourceCode: string | null;

  @Property({ type: 'string', length: 100, unique: true })
  code: string;

  @Property({ type: 'string', length: 200 })
  name: string;

  @Enum({ items: () => OfficeScope })
  scope: OfficeScope;

  @Property({ type: 'timestamptz' })
  createdAt: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    code: string,
    name: string,
    scope: OfficeScope,
    sourceCode: string | null = null,
    createdAt = new Date(),
  ) {
    if (code.trim().length === 0) {
      throw new Error('Office code must not be empty');
    }
    if (name.trim().length === 0) {
      throw new Error('Office name must not be empty');
    }
    if (!Object.values(OfficeScope).includes(scope)) {
      throw new Error('Office scope is invalid');
    }
    if (sourceCode !== null && sourceCode.trim().length === 0) {
      throw new Error('Office source code must not be empty');
    }

    this.code = code;
    this.name = name;
    this.scope = scope;
    this.sourceCode = sourceCode;
    this.createdAt = createdAt;
    this.updatedAt = createdAt;
  }
}
