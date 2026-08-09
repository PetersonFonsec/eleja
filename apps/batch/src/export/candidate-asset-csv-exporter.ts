import { CandidateAsset, type initializeDatabase } from '@eleja/database';
import { CANDIDATE_ASSET_CSV_COLUMNS } from './public-csv-schemas.js';
import { publicText, writeCsvExport } from './csv-export-writer.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;

export class CandidateAssetCsvExporter {
  constructor(
    private readonly orm: Database,
    private readonly batchSize = 1000,
  ) {}

  export(year: number, outputDirectory: string) {
    return writeCsvExport({
      dataset: 'CANDIDATE_ASSETS',
      year,
      fileName: 'candidate-assets.csv',
      outputDirectory,
      columns: CANDIDATE_ASSET_CSV_COLUMNS,
      records: this.records(year),
    });
  }

  private async *records(year: number) {
    const em = this.orm.em.fork();
    let offset = 0;
    while (true) {
      const entities = await em.find(
        CandidateAsset,
        { candidacy: { election: { year } } },
        {
          populate: ['candidacy'],
          orderBy: {
            candidacy: { id: 'ASC' },
            sourceSequence: 'ASC',
            id: 'ASC',
          },
          limit: this.batchSize,
          offset,
        },
      );
      for (const asset of entities) {
        yield {
          asset_id: asset.id,
          candidate_id: asset.candidacy.id,
          source_sequence: asset.sourceSequence,
          asset_type_code: publicText(asset.typeCode),
          asset_type: publicText(asset.type),
          description: publicText(asset.description),
          declared_value: asset.value,
        };
      }
      em.clear();
      if (entities.length < this.batchSize) return;
      offset += entities.length;
    }
  }
}
