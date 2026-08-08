import { Migration } from '@mikro-orm/migrations';

export class Migration20260808232024 extends Migration {
  override name = 'Migration20260808232024';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "candidate_sources" ("id" uuid not null, "candidacy_id" uuid not null, "type" text not null, "name" varchar(200) not null, "source_identifier" varchar(100) not null, "source_url" text null, "raw_storage_key" text not null, "raw_checksum" varchar(64) not null, "imported_at" timestamptz not null, "last_checked_at" timestamptz not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "candidate_sources_candidacy_id_index" on "candidate_sources" ("candidacy_id");`,
    );
    this.addSql(
      `create index "candidate_sources_source_identifier_index" on "candidate_sources" ("source_identifier");`,
    );
    this.addSql(
      `create index "candidate_sources_raw_checksum_index" on "candidate_sources" ("raw_checksum");`,
    );
    this.addSql(
      `alter table "candidate_sources" add constraint "candidate_sources_observation_unique" unique ("candidacy_id", "type", "raw_checksum", "source_identifier");`,
    );

    this.addSql(
      `alter table "candidate_sources" add constraint "candidate_sources_candidacy_id_foreign" foreign key ("candidacy_id") references "candidacies" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "candidate_sources" add constraint "candidate_sources_type_check" check ("type" in ('TSE', 'GOVERNMENT', 'PARTY', 'CANDIDATE_WEBSITE', 'SOCIAL_NETWORK', 'OTHER'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "candidate_sources" cascade;`);
  }
}
