import { initializeDatabase } from '@eleja/database';
import { CamaraParliamentaryExpenseImportJob } from './orchestration/camara-parliamentary-expense-import-job.js';
import { CamaraApiClient } from './sources/camara/camara-api-client.js';
import { CamaraParliamentaryExpenseSource } from './sources/camara/camara-parliamentary-expense-source.js';
function readYear(args: string[]): number {
  const inline = args.find((item) => item.startsWith('--year='));
  const index = args.indexOf('--year');
  return Number(
    inline?.slice(7) ?? (index >= 0 ? args[index + 1] : undefined) ?? '2026',
  );
}
async function main() {
  const year = readYear(process.argv.slice(2));
  const orm = await initializeDatabase();
  const started = performance.now();
  try {
    console.log('Câmara parliamentary expense import started');
    const result = await new CamaraParliamentaryExpenseImportJob(
      orm,
      new CamaraParliamentaryExpenseSource(
        new CamaraApiClient(
          fetch,
          Number(process.env.CAMARA_REQUEST_TIMEOUT_MS ?? 20_000),
        ),
      ),
    ).execute(year);
    for (const [key, value] of Object.entries(result))
      console.log(`${key}: ${value}`);
    console.log(
      `durationSeconds: ${((performance.now() - started) / 1000).toFixed(2)}`,
    );
    console.log('Câmara parliamentary expense import completed');
  } finally {
    await orm.close();
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
