import {
  openLocalCandidateRawArtifact,
  readCandidateArtifactArguments,
} from './local-candidate-raw-artifact.js';
import { TseCandidateDatasetParser } from './sources/tse/tse-candidate-parser.js';

async function main(): Promise<void> {
  const artifact = await openLocalCandidateRawArtifact(
    readCandidateArtifactArguments(process.argv.slice(2)),
  );
  const parser = new TseCandidateDatasetParser();
  const iterator = parser.parse(artifact.content, artifact.electionYear);

  console.log('TSE candidate parsing started');
  console.log(`Artifact: ${artifact.storageKey}`);
  console.log(`CSV entry: consulta_cand_${artifact.electionYear}_BRASIL.csv`);
  console.log('Encoding: ISO-8859-1');
  console.log('Delimiter: ;');

  let next = await iterator.next();
  while (!next.done) {
    next = await iterator.next();
  }
  const statistics = next.value;

  console.log('TSE candidate parsing completed');
  console.log(`Records read: ${statistics.recordsRead}`);
  console.log(`Parsed: ${statistics.recordsParsed}`);
  console.log(`Rejected: ${statistics.recordsRejected}`);
  console.log(`Duration: ${statistics.durationMs}ms`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
