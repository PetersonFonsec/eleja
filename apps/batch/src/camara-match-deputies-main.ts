import { initializeDatabase } from '@eleja/database';
import { CamaraDeputyIdentityMatchingJob } from './orchestration/camara-deputy-identity-matching-job.js';
import { CamaraDeputySource } from './sources/camara/camara-deputy-source.js';

function readYear(arguments_: string[]): number {
  const inline = arguments_.find((argument) => argument.startsWith('--year='));
  const index = arguments_.indexOf('--year');
  return Number(
    inline?.slice(7) ??
      (index >= 0 ? arguments_[index + 1] : undefined) ??
      '2026',
  );
}

async function main(): Promise<void> {
  const year = readYear(process.argv.slice(2));
  const timeoutMs = Number(process.env.CAMARA_REQUEST_TIMEOUT_MS ?? 20_000);
  const startDate = process.env.CAMARA_DEPUTIES_START_DATE ?? '1987-02-01';
  const endDate =
    process.env.CAMARA_DEPUTIES_END_DATE ??
    new Date().toISOString().slice(0, 10);
  const orm = await initializeDatabase();
  try {
    console.log('Câmara deputy identity matching started');
    console.log(`Election year: ${year}`);
    const statistics = await new CamaraDeputyIdentityMatchingJob(
      orm,
      new CamaraDeputySource(fetch, timeoutMs),
    ).execute(year, { startDate, endDate });
    console.log(
      `Câmara deputy records loaded: ${statistics.deputyRecordsLoaded}`,
    );
    console.log(`People considered: ${statistics.peopleConsidered}`);
    console.log(`Already linked: ${statistics.alreadyLinked}`);
    console.log(`Matched: ${statistics.matched}`);
    console.log(`Ambiguous: ${statistics.ambiguous}`);
    console.log(`Not found: ${statistics.notFound}`);
    console.log(`Identity conflicts: ${statistics.conflicts}`);
    console.log(`Errors: ${statistics.errors}`);
    console.log('Câmara deputy identity matching finished');
  } finally {
    await orm.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
