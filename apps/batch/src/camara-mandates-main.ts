import { initializeDatabase } from '@eleja/database';
import { CamaraMandateImportJob } from './orchestration/camara-mandate-import-job.js';
import { CamaraApiClient } from './sources/camara/camara-api-client.js';
import { CamaraDeputyMandateSource } from './sources/camara/camara-deputy-mandate-source.js';

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
  const orm = await initializeDatabase();
  const startedAt = performance.now();
  try {
    console.log('Câmara mandate import started');
    console.log(`Election population year: ${year}`);
    const statistics = await new CamaraMandateImportJob(
      orm,
      new CamaraDeputyMandateSource(new CamaraApiClient(fetch, timeoutMs)),
    ).execute(year);
    console.log(`People considered: ${statistics.peopleConsidered}`);
    console.log(`CAMARA identities found: ${statistics.camaraIdentitiesFound}`);
    console.log(`Deputies queried: ${statistics.deputiesQueried}`);
    console.log(`Mandate records read: ${statistics.mandateRecordsRead}`);
    console.log(`Normalized: ${statistics.normalized}`);
    console.log(`Inserted: ${statistics.inserted}`);
    console.log(`Updated: ${statistics.updated}`);
    console.log(`Unchanged: ${statistics.unchanged}`);
    console.log(`Normalization rejected: ${statistics.normalizationRejected}`);
    console.log(`Identity missing: ${statistics.identityMissing}`);
    console.log(`Errors: ${statistics.errors}`);
    console.log(
      `Duration: ${((performance.now() - startedAt) / 1000).toFixed(2)}s`,
    );
    console.log('Câmara mandate import completed');
  } finally {
    await orm.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
