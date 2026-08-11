import { initializeDatabase } from '@eleja/database';
import { CamaraProposalImportJob } from './orchestration/camara-proposal-import-job.js';
import { CamaraApiClient } from './sources/camara/camara-api-client.js';
import { CamaraProposalSource } from './sources/camara/camara-proposal-source.js';

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
    console.log('Câmara proposal import started');
    console.log(`Election population year: ${year}`);
    const result = await new CamaraProposalImportJob(
      orm,
      new CamaraProposalSource(new CamaraApiClient(fetch, timeoutMs)),
    ).execute(year);
    for (const [label, value] of Object.entries({
      'People considered': result.peopleConsidered,
      'CAMARA identities found': result.camaraIdentitiesFound,
      'Deputies queried': result.deputiesQueried,
      'Proposal references read': result.proposalReferencesRead,
      'Unique proposals fetched': result.uniqueProposalsFetched,
      'Proposals normalized': result.proposalsNormalized,
      'Proposals inserted': result.proposalsInserted,
      'Proposals updated': result.proposalsUpdated,
      'Proposals unchanged': result.proposalsUnchanged,
      'Proposals rejected': result.proposalsRejected,
      'Author records read': result.authorRecordsRead,
      'Eleja authors resolved': result.elejaAuthorsResolved,
      'Authorship inserted': result.authorshipInserted,
      'Authorship updated': result.authorshipUpdated,
      'Authorship unchanged': result.authorshipUnchanged,
      'Authors not mapped': result.authorsNotMapped,
      Errors: result.errors,
    })) {
      console.log(`${label}: ${value}`);
    }
    console.log(
      `Duration: ${((performance.now() - startedAt) / 1000).toFixed(2)}s`,
    );
    console.log('Câmara proposal import completed');
  } finally {
    await orm.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
