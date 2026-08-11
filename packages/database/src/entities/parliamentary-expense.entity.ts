import {
  Entity,
  Enum,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'node:crypto';
import { LegislativeMandate } from './legislative-mandate.entity.js';
import { LegislativeSource } from './legislative-source.js';
import { Person } from './person.entity.js';

@Entity({ tableName: 'parliamentary_expenses' })
@Unique({
  name: 'parliamentary_expenses_source_external_id_unique',
  properties: ['source', 'externalId'],
})
export class ParliamentaryExpense {
  @PrimaryKey({ type: 'uuid' }) id = randomUUID();
  @ManyToOne(() => Person, { index: true, deleteRule: 'restrict' })
  readonly person: Person;
  @ManyToOne(() => LegislativeMandate, {
    nullable: true,
    index: true,
    deleteRule: 'restrict',
  })
  mandate: LegislativeMandate | null;
  @Enum({ items: () => LegislativeSource }) readonly source: LegislativeSource;
  @Property({ type: 'string', length: 160 }) readonly externalId: string;
  @Property({ type: 'integer', index: true }) year: number;
  @Property({ type: 'integer' }) month: number;
  @Property({ type: 'string', length: 50, nullable: true, index: true })
  categoryCode: string | null;
  @Property({ type: 'text' }) category: string;
  @Property({ type: 'text', nullable: true }) supplierName: string | null;
  @Property({ type: 'string', length: 40, nullable: true }) supplierDocument:
    string | null;
  @Property({ type: 'string', length: 160, nullable: true }) documentNumber:
    string | null;
  @Property({ type: 'string', length: 100, nullable: true }) documentType:
    string | null;
  @Property({ type: 'date', nullable: true }) documentDate: string | null;
  @Property({ type: 'decimal', precision: 24, scale: 2 }) grossValue: string;
  @Property({ type: 'decimal', precision: 24, scale: 2 }) netValue: string;
  @Property({ type: 'decimal', precision: 24, scale: 2 })
  deductionValue: string;
  @Property({ type: 'text', nullable: true }) sourceUrl: string | null;
  @Property({ type: 'timestamptz' }) createdAt: Date;
  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date;

  constructor(
    person: Person,
    source: LegislativeSource,
    externalId: string,
    year: number,
    month: number,
    category: string,
    grossValue: string,
    netValue: string,
    deductionValue: string,
    options: {
      mandate?: LegislativeMandate | null;
      categoryCode?: string | null;
      supplierName?: string | null;
      supplierDocument?: string | null;
      documentNumber?: string | null;
      documentType?: string | null;
      documentDate?: string | null;
      sourceUrl?: string | null;
      createdAt?: Date;
    } = {},
  ) {
    if (!person) throw new Error('Parliamentary expense requires a person');
    if (!Object.values(LegislativeSource).includes(source))
      throw new Error('Parliamentary expense source is invalid');
    if (!externalId.trim())
      throw new Error('Parliamentary expense external identifier is required');
    if (!Number.isSafeInteger(year) || year < 1900 || year > 9999)
      throw new Error('Parliamentary expense year is invalid');
    if (!Number.isSafeInteger(month) || month < 1 || month > 12)
      throw new Error('Parliamentary expense month is invalid');
    if (!category.trim())
      throw new Error('Parliamentary expense category is required');
    for (const value of [grossValue, netValue, deductionValue])
      if (!/^-?(0|[1-9]\d*)\.\d{2}$/.test(value))
        throw new Error('Parliamentary expense value must be an exact decimal');
    if (options.mandate && options.mandate.person.id !== person.id)
      throw new Error(
        'Parliamentary expense mandate must belong to its person',
      );
    this.person = person;
    this.source = source;
    this.externalId = externalId;
    this.year = year;
    this.month = month;
    this.category = category;
    this.grossValue = grossValue;
    this.netValue = netValue;
    this.deductionValue = deductionValue;
    this.mandate = options.mandate ?? null;
    this.categoryCode = options.categoryCode ?? null;
    this.supplierName = options.supplierName ?? null;
    this.supplierDocument = options.supplierDocument ?? null;
    this.documentNumber = options.documentNumber ?? null;
    this.documentType = options.documentType ?? null;
    this.documentDate = options.documentDate ?? null;
    this.sourceUrl = options.sourceUrl ?? null;
    this.createdAt = options.createdAt ?? new Date();
    this.updatedAt = this.createdAt;
  }
}
