import { Migration } from '@mikro-orm/migrations';

export class Migration20260810220000 extends Migration {
  override name = 'Migration20260810220000';

  override up(): void {
    this.addSql(
      `create table "legislative_votings" ("id" uuid not null, "source" text not null, "external_id" varchar(160) not null, "date_time" timestamp(0) without time zone not null, "description" text null, "result" text not null, "source_result" varchar(40) null, "proposal_id" uuid null, "source_url" text not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "legislative_votings" add constraint "legislative_votings_source_external_id_unique" unique ("source", "external_id");`,
    );
    this.addSql(
      `create index "legislative_votings_date_time_index" on "legislative_votings" ("date_time");`,
    );
    this.addSql(
      `create index "legislative_votings_proposal_id_index" on "legislative_votings" ("proposal_id");`,
    );
    this.addSql(
      `alter table "legislative_votings" add constraint "legislative_votings_source_check" check ("source" in ('CAMARA', 'SENADO'));`,
    );
    this.addSql(
      `alter table "legislative_votings" add constraint "legislative_votings_result_check" check ("result" in ('APPROVED', 'REJECTED', 'UNKNOWN'));`,
    );
    this.addSql(
      `alter table "legislative_votings" add constraint "legislative_votings_proposal_id_foreign" foreign key ("proposal_id") references "legislative_proposals" ("id") on delete restrict;`,
    );

    this.addSql(
      `create table "legislative_votes" ("id" uuid not null, "voting_id" uuid not null, "person_id" uuid not null, "mandate_id" uuid null, "position" text not null, "source_position" varchar(100) not null, "voted_at" timestamp(0) without time zone null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "legislative_votes_voting_id_index" on "legislative_votes" ("voting_id");`,
    );
    this.addSql(
      `create index "legislative_votes_person_id_index" on "legislative_votes" ("person_id");`,
    );
    this.addSql(
      `create index "legislative_votes_mandate_id_index" on "legislative_votes" ("mandate_id");`,
    );
    this.addSql(
      `alter table "legislative_votes" add constraint "legislative_votes_voting_person_unique" unique ("voting_id", "person_id");`,
    );
    this.addSql(
      `alter table "legislative_votes" add constraint "legislative_votes_position_check" check ("position" in ('YES', 'NO', 'ABSTENTION', 'OBSTRUCTION', 'OTHER', 'UNKNOWN'));`,
    );
    this.addSql(
      `alter table "legislative_votes" add constraint "legislative_votes_voting_id_foreign" foreign key ("voting_id") references "legislative_votings" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "legislative_votes" add constraint "legislative_votes_person_id_foreign" foreign key ("person_id") references "people" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "legislative_votes" add constraint "legislative_votes_mandate_id_foreign" foreign key ("mandate_id") references "legislative_mandates" ("id") on delete restrict;`,
    );
  }

  override down(): void {
    this.addSql(`drop table if exists "legislative_votes" cascade;`);
    this.addSql(`drop table if exists "legislative_votings" cascade;`);
  }
}
