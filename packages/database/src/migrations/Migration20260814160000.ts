import { Migration } from '@mikro-orm/migrations';

export class Migration20260814160000 extends Migration {
  override name = 'Migration20260814160000';

  override up(): void {
    this.addSql(
      `alter table "people" add column "birth_state" varchar(2) null;`,
    );
    this.addSql(
      `create index "people_birth_date_birth_state_gender_idx" on "people" ("birth_date", "birth_state", "gender");`,
    );
  }

  override down(): void {
    this.addSql(
      `drop index if exists "people_birth_date_birth_state_gender_idx";`,
    );
    this.addSql(`alter table "people" drop column "birth_state";`);
  }
}
