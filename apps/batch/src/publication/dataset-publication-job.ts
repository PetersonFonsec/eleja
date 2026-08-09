import {
  DatasetVersion,
  DatasetVersionStatus,
  type initializeDatabase,
} from '@eleja/database';
import type {
  DatasetPublicationResult,
  PublicDatasetPublication,
} from './public-dataset-publication.js';

type Database = Awaited<ReturnType<typeof initializeDatabase>>;
type Publication = Pick<PublicDatasetPublication, 'publish'>;

export class DatasetPublicationJob {
  constructor(
    private readonly orm: Database,
    private readonly publication: Publication,
  ) {}

  async execute(input: {
    year: number;
    version: string;
    exportDirectory: string;
  }): Promise<DatasetPublicationResult> {
    const em = this.orm.em.fork();
    const datasetVersion = await em.findOne(DatasetVersion, {
      version: input.version,
    });
    if (!datasetVersion) {
      throw new Error(`DatasetVersion not found: ${input.version}`);
    }
    if (
      datasetVersion.status !== DatasetVersionStatus.READY &&
      datasetVersion.status !== DatasetVersionStatus.PUBLISHED
    ) {
      throw new Error(
        `Cannot publish dataset in ${datasetVersion.status} status`,
      );
    }

    const result = await this.publication.publish({
      ...input,
      publishedAt: datasetVersion.publishedAt ?? undefined,
    });
    if (datasetVersion.status === DatasetVersionStatus.READY) {
      datasetVersion.publish(result.publishedAt);
      await em.flush();
    }
    return result;
  }
}
