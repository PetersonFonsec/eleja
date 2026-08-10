import { Migration } from '@mikro-orm/migrations';

export class Migration20260810185826 extends Migration {
  override name = 'Migration20260810185826';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "legislative_mandates" add constraint "legislative_mandates_person_body_legislature_unique" unique ("person_id", "body", "legislature_number");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "legislative_mandates" drop constraint "legislative_mandates_person_body_legislature_unique";`,
    );
  }
}
