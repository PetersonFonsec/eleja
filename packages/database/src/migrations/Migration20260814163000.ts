import { Migration } from '@mikro-orm/migrations';

export class Migration20260814163000 extends Migration {
  override name = 'Migration20260814163000';

  override up(): void {
    this.addSql(
      `alter table "parties" drop constraint if exists "parties_source_party_id_unique";`,
    );
    this.addSql(
      `alter table "parties" drop constraint if exists "parties_acronym_unique";`,
    );
    this.addSql(
      `alter table "parties" drop constraint if exists "parties_number_unique";`,
    );
    this.addSql(
      `alter table "parties" add constraint "parties_name_acronym_number_unique" unique ("name", "acronym", "number");`,
    );
    this.addSql(`create index "parties_acronym_idx" on "parties" ("acronym");`);
    this.addSql(`create index "parties_number_idx" on "parties" ("number");`);
  }

  override down(): void {
    this.addSql(`drop index if exists "parties_acronym_idx";`);
    this.addSql(`drop index if exists "parties_number_idx";`);
    this.addSql(
      `alter table "parties" drop constraint if exists "parties_name_acronym_number_unique";`,
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
  }
}
