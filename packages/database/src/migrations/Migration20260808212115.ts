import { Migration } from '@mikro-orm/migrations';

export class Migration20260808212115 extends Migration {
  override name = 'Migration20260808212115';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "elections" ("id" uuid not null, "year" int not null, "type" text not null, "round" smallint null, "start_date" date null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create unique index "elections_year_type_without_round_unique" on "elections" ("year", "type") where round is null;`,
    );
    this.addSql(
      `create unique index "elections_year_type_round_unique" on "elections" ("year", "type", "round") where round is not null;`,
    );

    this.addSql(
      `create table "offices" ("id" uuid not null, "source_code" varchar(100) null, "code" varchar(100) not null, "name" varchar(200) not null, "scope" text not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "offices" add constraint "offices_source_code_unique" unique ("source_code");`,
    );
    this.addSql(
      `alter table "offices" add constraint "offices_code_unique" unique ("code");`,
    );

    this.addSql(
      `create table "parties" ("id" uuid not null, "source_party_id" varchar(100) null, "name" varchar(200) not null, "acronym" varchar(30) not null, "number" smallint null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "parties" add constraint "parties_source_party_id_unique" unique ("source_party_id");`,
    );
    this.addSql(
      `alter table "parties" add constraint "parties_acronym_unique" unique ("acronym");`,
    );
    this.addSql(
      `alter table "parties" add constraint "parties_number_unique" unique ("number");`,
    );

    this.addSql(
      `alter table "elections" add constraint "elections_type_check" check ("type" in ('GENERAL', 'MUNICIPAL'));`,
    );

    this.addSql(
      `alter table "offices" add constraint "offices_scope_check" check ("scope" in ('NATIONAL', 'STATE', 'MUNICIPAL', 'DISTRICT'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "elections" cascade;`);
    this.addSql(`drop table if exists "offices" cascade;`);
    this.addSql(`drop table if exists "parties" cascade;`);
  }
}
