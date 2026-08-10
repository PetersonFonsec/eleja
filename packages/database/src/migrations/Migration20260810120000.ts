import { Migration } from '@mikro-orm/migrations';

export class Migration20260810120000 extends Migration {
  override name = 'Migration20260810120000';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "person_external_identities" ("id" uuid not null, "person_id" uuid not null, "source" text not null, "external_id" varchar(160) not null, "source_url" text null, "verified_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "person_external_identities_person_id_index" on "person_external_identities" ("person_id");`,
    );
    this.addSql(
      `alter table "person_external_identities" add constraint "person_external_identities_source_external_id_unique" unique ("source", "external_id");`,
    );

    this.addSql(
      `create table "legislative_mandates" ("id" uuid not null, "person_id" uuid not null, "body" text not null, "external_mandate_id" varchar(160) null, "legislature_number" int null, "state" varchar(2) null, "party_acronym" varchar(30) null, "started_at" date null, "ended_at" date null, "status" text not null, "source_status" varchar(200) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "legislative_mandates_person_id_index" on "legislative_mandates" ("person_id");`,
    );
    this.addSql(
      `create index "legislative_mandates_body_legislature_number_idx" on "legislative_mandates" ("body", "legislature_number");`,
    );

    this.addSql(
      `create table "legislative_proposals" ("id" uuid not null, "source" text not null, "external_id" varchar(160) not null, "type" varchar(50) not null, "number" int null, "year" int null, "title" text null, "summary" text null, "status" varchar(100) null, "source_status" varchar(200) null, "url" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "legislative_proposals" add constraint "legislative_proposals_source_external_id_unique" unique ("source", "external_id");`,
    );
    this.addSql(
      `create index "legislative_proposals_year_index" on "legislative_proposals" ("year");`,
    );
    this.addSql(
      `create index "legislative_proposals_type_year_idx" on "legislative_proposals" ("type", "year");`,
    );

    this.addSql(
      `create table "legislative_proposal_authors" ("id" uuid not null, "proposal_id" uuid not null, "person_id" uuid not null, "mandate_id" uuid null, "role" text not null, "is_primary_author" boolean not null default false, "source_author_order" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "legislative_proposal_authors_proposal_id_index" on "legislative_proposal_authors" ("proposal_id");`,
    );
    this.addSql(
      `create index "legislative_proposal_authors_person_id_index" on "legislative_proposal_authors" ("person_id");`,
    );
    this.addSql(
      `create index "legislative_proposal_authors_mandate_id_index" on "legislative_proposal_authors" ("mandate_id");`,
    );
    this.addSql(
      `alter table "legislative_proposal_authors" add constraint "legislative_proposal_authors_proposal_person_unique" unique ("proposal_id", "person_id");`,
    );

    this.addSql(
      `alter table "person_external_identities" add constraint "person_external_identities_person_id_foreign" foreign key ("person_id") references "people" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "person_external_identities" add constraint "person_external_identities_source_check" check ("source" in ('TSE', 'CAMARA', 'SENADO'));`,
    );
    this.addSql(
      `alter table "legislative_mandates" add constraint "legislative_mandates_person_id_foreign" foreign key ("person_id") references "people" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "legislative_mandates" add constraint "legislative_mandates_body_check" check ("body" in ('CHAMBER_OF_DEPUTIES', 'SENATE'));`,
    );
    this.addSql(
      `alter table "legislative_mandates" add constraint "legislative_mandates_status_check" check ("status" in ('ACTIVE', 'COMPLETED', 'INTERRUPTED', 'UNKNOWN'));`,
    );
    this.addSql(
      `alter table "legislative_proposals" add constraint "legislative_proposals_source_check" check ("source" in ('CAMARA', 'SENADO'));`,
    );
    this.addSql(
      `alter table "legislative_proposal_authors" add constraint "legislative_proposal_authors_proposal_id_foreign" foreign key ("proposal_id") references "legislative_proposals" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "legislative_proposal_authors" add constraint "legislative_proposal_authors_person_id_foreign" foreign key ("person_id") references "people" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "legislative_proposal_authors" add constraint "legislative_proposal_authors_mandate_id_foreign" foreign key ("mandate_id") references "legislative_mandates" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "legislative_proposal_authors" add constraint "legislative_proposal_authors_role_check" check ("role" in ('AUTHOR', 'COAUTHOR', 'UNKNOWN'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "legislative_proposal_authors" cascade;`);
    this.addSql(`drop table if exists "legislative_proposals" cascade;`);
    this.addSql(`drop table if exists "legislative_mandates" cascade;`);
    this.addSql(`drop table if exists "person_external_identities" cascade;`);
  }
}
