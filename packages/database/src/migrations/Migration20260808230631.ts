import { Migration } from '@mikro-orm/migrations';

export class Migration20260808230631 extends Migration {
  override name = 'Migration20260808230631';

  override up(): void | Promise<void> {
    this.addSql(
      `create index "people_name_birth_date_idx" on "people" ("name", "birth_date");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop index "people_name_birth_date_idx";`);
  }
}
