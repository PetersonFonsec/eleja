import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import type {
  DatasetPublisher,
  DatasetPublisherPutInput,
  PublishedObject,
} from './dataset-publisher.js';
import type { R2Config } from './r2-config.js';

interface S3Sender {
  send(command: HeadObjectCommand | PutObjectCommand): Promise<unknown>;
}

export class R2DatasetPublisher implements DatasetPublisher {
  private readonly client: S3Sender;

  constructor(
    private readonly config: R2Config,
    client?: S3Sender,
  ) {
    this.client = client ?? new S3Client(clientConfig(config));
  }

  async inspect(key: string): Promise<PublishedObject | null> {
    try {
      const response = (await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
      )) as { ContentLength?: number; Metadata?: Record<string, string> };
      return {
        key,
        size: response.ContentLength ?? 0,
        metadata: response.Metadata ?? {},
      };
    } catch (error: unknown) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async put(input: DatasetPublisherPutInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentLength: input.size,
        ContentType: input.contentType,
        ContentDisposition: input.contentDisposition,
        CacheControl: input.cacheControl,
        Metadata: input.metadata,
        IfNoneMatch: input.immutable ? '*' : undefined,
      }),
    );
  }

  publicUrl(key: string): string {
    const base = this.config.publicBaseUrl.replace(/\/+$/, '');
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return `${base}/${encodedKey}`;
  }
}

function clientConfig(config: R2Config): S3ClientConfig {
  return {
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  };
}

function isNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const candidate = error as Error & {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === 'NotFound' || candidate.$metadata?.httpStatusCode === 404
  );
}
