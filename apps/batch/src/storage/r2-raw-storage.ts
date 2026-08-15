import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import type {
  RawStorage,
  RawStoragePutOptions,
  RawStoragePutResult,
} from './raw-storage.js';

export interface R2RawStorageConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

type R2Command = HeadObjectCommand | GetObjectCommand | PutObjectCommand;

export interface R2Client {
  send(command: R2Command): Promise<unknown>;
}

export class RawStorageError extends Error {
  constructor(
    message: string,
    readonly operation: 'exists' | 'get' | 'put',
    readonly key: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'RawStorageError';
  }
}

export class R2RawStorage implements RawStorage {
  private readonly client: R2Client;

  constructor(
    private readonly config: R2RawStorageConfig,
    client?: R2Client,
  ) {
    this.client = client ?? createR2Client(config);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      return true;
    } catch (error: unknown) {
      if (isNotFound(error)) return false;
      throw storageError('exists', key, error);
    }
  }

  async get(key: string): Promise<Readable> {
    try {
      const response = (await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      )) as { Body?: unknown };
      if (!response.Body) throw new Error('R2 returned an empty response body');
      if (response.Body instanceof Readable) return response.Body;
      if (
        typeof response.Body === 'object' &&
        Symbol.asyncIterator in response.Body
      ) {
        return Readable.from(response.Body as AsyncIterable<Uint8Array>);
      }
      throw new Error('R2 returned an unsupported response body');
    } catch (error: unknown) {
      throw storageError('get', key, error);
    }
  }

  async put(
    key: string,
    content: Readable,
    options: RawStoragePutOptions = {},
  ): Promise<RawStoragePutResult> {
    if (await this.exists(key)) {
      content.destroy();
      return { stored: false };
    }
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: content,
          ContentLength: options.contentLength,
          ContentType: options.contentType,
          Metadata: options.metadata,
          IfNoneMatch: '*',
        }),
      );
      return { stored: true };
    } catch (error: unknown) {
      if (isPreconditionFailed(error)) return { stored: false };
      throw storageError('put', key, error);
    }
  }
}

export function createR2Client(config: R2RawStorageConfig): S3Client {
  const clientConfig: S3ClientConfig = {
    region: 'auto',
    endpoint: config.endpoint,
    maxAttempts: 3,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  };
  return new S3Client(clientConfig);
}

function isNotFound(error: unknown): boolean {
  return (
    errorStatus(error) === 404 ||
    errorName(error) === 'NotFound' ||
    errorName(error) === 'NoSuchKey'
  );
}

function isPreconditionFailed(error: unknown): boolean {
  return (
    errorStatus(error) === 412 || errorName(error) === 'PreconditionFailed'
  );
}

function storageError(
  operation: 'exists' | 'get' | 'put',
  key: string,
  cause: unknown,
): RawStorageError {
  const status = errorStatus(cause);
  const name = errorName(cause);
  let reason = 'request failed';
  if (
    status === 401 ||
    name === 'InvalidAccessKeyId' ||
    name === 'SignatureDoesNotMatch'
  )
    reason = 'credentials were rejected';
  else if (status === 403 || name === 'AccessDenied')
    reason = 'access was denied';
  else if (name === 'NoSuchBucket') reason = 'bucket was not found';
  else if (isNotFound(cause)) reason = 'object was not found';
  else if (name === 'TimeoutError' || name === 'RequestTimeout')
    reason = 'network request timed out';
  return new RawStorageError(
    `R2 RAW storage ${operation} failed for key "${key}": ${reason}`,
    operation,
    key,
    { cause },
  );
}

function errorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

function errorStatus(error: unknown): number | undefined {
  return error && typeof error === 'object' && '$metadata' in error
    ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode
    : undefined;
}
