import { Migration } from '@mikro-orm/migrations';

export class Migration20260808210500 extends Migration {
  override name = 'Migration20260808210500';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "dataset_versions" ("id" uuid not null, "version" varchar(64) not null, "status" text not null, "started_at" timestamptz not null, "finished_at" timestamptz null, "published_at" timestamptz null, "source_updated_at" timestamptz null, "records_read" int not null default 0, "records_inserted" int not null default 0, "records_updated" int not null default 0, "records_rejected" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "dataset_versions" add constraint "dataset_versions_version_unique" unique ("version");`,
    );

    this.addSql(
      `create table "batch_runs" ("id" uuid not null, "dataset_version_id" uuid not null, "source" varchar(100) not null, "status" text not null, "started_at" timestamptz not null, "finished_at" timestamptz null, "records_read" int not null default 0, "records_inserted" int not null default 0, "records_updated" int not null default 0, "records_rejected" int not null default 0, "error_message" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "batch_runs_dataset_version_id_index" on "batch_runs" ("dataset_version_id");`,
    );
    this.addSql(
      `create index "batch_runs_status_index" on "batch_runs" ("status");`,
    );

    this.addSql(
      `alter table "dataset_versions" add constraint "dataset_versions_status_check" check ("status" in ('PROCESSING', 'READY', 'PUBLISHED', 'FAILED'));`,
    );

    this.addSql(
      `alter table "batch_runs" add constraint "batch_runs_dataset_version_id_foreign" foreign key ("dataset_version_id") references "dataset_versions" ("id");`,
    );
    this.addSql(
      `alter table "batch_runs" add constraint "batch_runs_status_check" check ("status" in ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "batch_runs" drop constraint "batch_runs_dataset_version_id_foreign";`,
    );

    this.addSql(`drop table if exists "dataset_versions" cascade;`);
    this.addSql(`drop table if exists "batch_runs" cascade;`);
  }
}
