import { Migration } from '@mikro-orm/migrations';

export class Migration20260808215246 extends Migration {
  override name = 'Migration20260808215246';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "people" ("id" uuid not null, "name" varchar(200) not null, "birth_date" date null, "gender" varchar(100) null, "education" varchar(200) null, "occupation" varchar(200) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );

    this.addSql(
      `create table "candidacies" ("id" uuid not null, "source_candidate_id" varchar(100) null, "ballot_name" varchar(200) not null, "ballot_number" int null, "state" varchar(10) null, "city" varchar(200) null, "photo_url" text null, "status" text not null, "source_status" varchar(200) null, "person_id" uuid not null, "election_id" uuid not null, "party_id" uuid not null, "office_id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "candidacies" add constraint "candidacies_source_candidate_id_unique" unique ("source_candidate_id");`,
    );
    this.addSql(
      `create index "candidacies_state_index" on "candidacies" ("state");`,
    );
    this.addSql(
      `create index "candidacies_person_id_index" on "candidacies" ("person_id");`,
    );
    this.addSql(
      `create index "candidacies_election_id_index" on "candidacies" ("election_id");`,
    );
    this.addSql(
      `create index "candidacies_party_id_index" on "candidacies" ("party_id");`,
    );
    this.addSql(
      `create index "candidacies_office_id_index" on "candidacies" ("office_id");`,
    );

    this.addSql(
      `alter table "candidacies" add constraint "candidacies_person_id_foreign" foreign key ("person_id") references "people" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "candidacies" add constraint "candidacies_election_id_foreign" foreign key ("election_id") references "elections" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "candidacies" add constraint "candidacies_party_id_foreign" foreign key ("party_id") references "parties" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "candidacies" add constraint "candidacies_office_id_foreign" foreign key ("office_id") references "offices" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "candidacies" add constraint "candidacies_status_check" check ("status" in ('ACTIVE', 'INACTIVE', 'UNKNOWN'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "candidacies" drop constraint "candidacies_person_id_foreign";`,
    );

    this.addSql(`drop table if exists "people" cascade;`);
    this.addSql(`drop table if exists "candidacies" cascade;`);
  }
}
