import {
  openLocalCandidateRawArtifact,
  readCandidateArtifactArguments,
} from './local-candidate-raw-artifact.js';
import { TseCandidateNormalizer } from './normalization/tse-candidate-normalizer.js';
import { TseCandidateDatasetParser } from './sources/tse/tse-candidate-parser.js';

async function main(): Promise<void> {
  const artifact = await openLocalCandidateRawArtifact(
    readCandidateArtifactArguments(process.argv.slice(2)),
  );
  const parser = new TseCandidateDatasetParser();
  const normalizer = new TseCandidateNormalizer();
  const iterator = parser.parse(artifact.content, artifact.electionYear);
  const normalizationIssues = new Map<string, number>();
  let normalized = 0;
  let parserRejected = 0;
  let normalizerRejected = 0;

  console.log('TSE candidate normalization started');
  console.log(`Artifact: ${artifact.storageKey}`);

  let next = await iterator.next();
  while (!next.done) {
    if (next.value.status === 'REJECTED') {
      parserRejected += 1;
    } else {
      const result = normalizer.normalize(next.value.record);
      if (result.status === 'SUCCESS') {
        normalized += 1;
      } else {
        normalizerRejected += 1;
        const sourceValue = [
          'electionType',
          'electionRound',
          'office',
          'candidacyStatus',
          'state',
        ].includes(result.issue.field)
          ? result.issue.sourceValue
          : '';
        const key = [result.issue.field, sourceValue, result.issue.reason].join(
          '|',
        );
        normalizationIssues.set(key, (normalizationIssues.get(key) ?? 0) + 1);
      }
    }
    next = await iterator.next();
  }
  const parseStatistics = next.value;

  console.log('TSE candidate normalization completed');
  console.log(`Parsed: ${parseStatistics.recordsParsed}`);
  console.log(`Normalized: ${normalized}`);
  console.log(`Parser rejected: ${parserRejected}`);
  console.log(`Normalizer rejected: ${normalizerRejected}`);
  if (normalizationIssues.size > 0) {
    console.log('Unexpected normalization values:');
    for (const [value, count] of [...normalizationIssues].sort()) {
      console.log(`${count} ${value}`);
    }
  } else {
    console.log('Unexpected normalization values: none');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
