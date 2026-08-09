import { Candidacy, type initializeDatabase } from '@eleja/database';
import { CANDIDATE_CSV_COLUMNS } from './public-csv-schemas.js';
import {
  publicText,
  publicValue,
  writeCsvExport,
} from './csv-export-writer.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;

export class CandidateCsvExporter {
  constructor(
    private readonly orm: Database,
    private readonly batchSize = 1000,
  ) {}

  export(year: number, outputDirectory: string) {
    return writeCsvExport({
      dataset: 'CANDIDATES',
      year,
      fileName: 'candidates.csv',
      outputDirectory,
      columns: CANDIDATE_CSV_COLUMNS,
      records: this.records(year),
    });
  }

  private async *records(year: number) {
    const em = this.orm.em.fork();
    let offset = 0;
    while (true) {
      const entities = await em.find(
        Candidacy,
        { election: { year } },
        {
          populate: ['person', 'party', 'office', 'election'],
          orderBy: {
            election: { year: 'ASC' },
            office: { code: 'ASC' },
            state: 'ASC',
            ballotNumber: 'ASC',
            id: 'ASC',
          },
          limit: this.batchSize,
          offset,
        },
      );
      for (const candidate of entities) {
        yield {
          candidate_id: candidate.id,
          source_candidate_id: publicValue(candidate.sourceCandidateId),
          election_year: candidate.election.year,
          election_type: candidate.election.type,
          election_round: publicValue(candidate.election.round),
          name: publicText(candidate.person.name),
          ballot_name: publicText(candidate.ballotName),
          ballot_number: publicValue(candidate.ballotNumber),
          status: candidate.status,
          source_status: publicText(candidate.sourceStatus),
          state: publicText(candidate.state),
          city: publicText(candidate.city),
          party_name: publicText(candidate.party.name),
          party_acronym: publicText(candidate.party.acronym),
          party_number: publicValue(candidate.party.number),
          office_code: publicText(candidate.office.code),
          office_name: publicText(candidate.office.name),
          office_scope: candidate.office.scope,
          birth_date: publicValue(candidate.person.birthDate),
          gender: publicText(candidate.person.gender),
          education: publicText(candidate.person.education),
          occupation: publicText(candidate.person.occupation),
          photo_url: publicText(candidate.photoUrl),
        };
      }
      em.clear();
      if (entities.length < this.batchSize) return;
      offset += entities.length;
    }
  }
}
