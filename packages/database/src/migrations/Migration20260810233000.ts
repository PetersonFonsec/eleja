import { Migration } from '@mikro-orm/migrations';

export class Migration20260810233000 extends Migration {
  override name = 'Migration20260810233000';
  override up(): void {
    this.addSql(
      `create table "parliamentary_expenses" ("id" uuid not null, "person_id" uuid not null, "mandate_id" uuid null, "source" text not null, "external_id" varchar(160) not null, "year" int not null, "month" int not null, "category_code" varchar(50) null, "category" text not null, "supplier_name" text null, "supplier_document" varchar(40) null, "document_number" varchar(160) null, "document_type" varchar(100) null, "document_date" date null, "gross_value" numeric(24,2) not null, "net_value" numeric(24,2) not null, "deduction_value" numeric(24,2) not null, "source_url" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "parliamentary_expenses_person_id_index" on "parliamentary_expenses" ("person_id");`,
    );
    this.addSql(
      `create index "parliamentary_expenses_mandate_id_index" on "parliamentary_expenses" ("mandate_id");`,
    );
    this.addSql(
      `create index "parliamentary_expenses_year_index" on "parliamentary_expenses" ("year");`,
    );
    this.addSql(
      `create index "parliamentary_expenses_category_code_index" on "parliamentary_expenses" ("category_code");`,
    );
    this.addSql(
      `alter table "parliamentary_expenses" add constraint "parliamentary_expenses_source_external_id_unique" unique ("source", "external_id");`,
    );
    this.addSql(
      `alter table "parliamentary_expenses" add constraint "parliamentary_expenses_source_check" check ("source" in ('CAMARA', 'SENADO'));`,
    );
    this.addSql(
      `alter table "parliamentary_expenses" add constraint "parliamentary_expenses_person_id_foreign" foreign key ("person_id") references "people" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "parliamentary_expenses" add constraint "parliamentary_expenses_mandate_id_foreign" foreign key ("mandate_id") references "legislative_mandates" ("id") on delete restrict;`,
    );
  }
  override down(): void {
    this.addSql(`drop table if exists "parliamentary_expenses" cascade;`);
  }
}
