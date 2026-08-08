import { Migration } from '@mikro-orm/migrations';

export class Migration20260808233503 extends Migration {
  override name = 'Migration20260808233503';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "candidate_assets" ("id" uuid not null, "candidacy_id" uuid not null, "source_sequence" int not null, "type_code" varchar(50) not null, "type" varchar(300) not null, "description" text null, "value" numeric(24,2) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "candidate_assets_candidacy_id_index" on "candidate_assets" ("candidacy_id");`,
    );
    this.addSql(
      `alter table "candidate_assets" add constraint "candidate_assets_candidacy_sequence_unique" unique ("candidacy_id", "source_sequence");`,
    );

    this.addSql(
      `create table "candidate_asset_sources" ("id" uuid not null, "candidate_asset_id" uuid not null, "type" text not null, "name" varchar(200) not null, "source_identifier" varchar(160) not null, "source_url" text null, "raw_storage_key" text not null, "raw_checksum" varchar(64) not null, "imported_at" timestamptz not null, "last_checked_at" timestamptz not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "candidate_asset_sources_candidate_asset_id_index" on "candidate_asset_sources" ("candidate_asset_id");`,
    );
    this.addSql(
      `create index "candidate_asset_sources_raw_checksum_index" on "candidate_asset_sources" ("raw_checksum");`,
    );
    this.addSql(
      `alter table "candidate_asset_sources" add constraint "candidate_asset_sources_observation_unique" unique ("candidate_asset_id", "raw_checksum", "source_identifier");`,
    );

    this.addSql(
      `alter table "candidate_assets" add constraint "candidate_assets_candidacy_id_foreign" foreign key ("candidacy_id") references "candidacies" ("id") on delete restrict;`,
    );

    this.addSql(
      `alter table "candidate_asset_sources" add constraint "candidate_asset_sources_candidate_asset_id_foreign" foreign key ("candidate_asset_id") references "candidate_assets" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "candidate_asset_sources" add constraint "candidate_asset_sources_type_check" check ("type" in ('TSE', 'GOVERNMENT', 'PARTY', 'CANDIDATE_WEBSITE', 'SOCIAL_NETWORK', 'OTHER'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "candidate_asset_sources" cascade;`);
    this.addSql(`drop table if exists "candidate_assets" cascade;`);
  }
}
