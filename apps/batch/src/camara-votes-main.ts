import { initializeDatabase } from '@eleja/database';
import { CamaraVotingImportJob } from './orchestration/camara-voting-import-job.js';
import { CamaraApiClient } from './sources/camara/camara-api-client.js';
import { CamaraVotingSource } from './sources/camara/camara-voting-source.js';

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
    console.log('Câmara voting import started');
    console.log(`Election population year: ${year}`);
    const result = await new CamaraVotingImportJob(
      orm,
      new CamaraVotingSource(new CamaraApiClient(fetch, timeoutMs)),
    ).execute(year);
    for (const [label, value] of Object.entries({
      'People considered': result.peopleConsidered,
      'CAMARA identities': result.camaraIdentities,
      'Mandates considered': result.mandatesConsidered,
      'Voting events read': result.votingEventsRead,
      'Unique voting events': result.uniqueVotingEvents,
      'Voting events inserted': result.votingEventsInserted,
      'Voting events updated': result.votingEventsUpdated,
      'Voting events unchanged': result.votingEventsUnchanged,
      'Voting events rejected': result.votingEventsRejected,
      'Individual votes read': result.individualVotesRead,
      'Eleja votes resolved': result.elejaVotesResolved,
      'Votes inserted': result.votesInserted,
      'Votes updated': result.votesUpdated,
      'Votes unchanged': result.votesUnchanged,
      'Unmapped deputies': result.unmappedDeputies,
      'Vote normalization rejected': result.voteNormalizationRejected,
      Errors: result.errors,
    }))
      console.log(`${label}: ${value}`);
    console.log(
      `Duration: ${((performance.now() - startedAt) / 1000).toFixed(2)}s`,
    );
    console.log('Câmara voting import completed');
  } finally {
    await orm.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
