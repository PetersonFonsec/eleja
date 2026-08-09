import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { R2DatasetPublisher } from '../src/publication/r2-dataset-publisher.js';
import { readR2Config } from '../src/publication/r2-config.js';

const config = {
  endpoint: 'https://account.r2.cloudflarestorage.com',
  accessKeyId: 'access-key',
  secretAccessKey: 'secret-key',
  bucket: 'datasets-bucket',
  publicBaseUrl: 'https://data.example.com/',
};

describe('R2DatasetPublisher', () => {
  it('constructs head and put requests with explicit publication metadata', async () => {
    const commands: Array<HeadObjectCommand | PutObjectCommand> = [];
    const client = {
      async send(command: HeadObjectCommand | PutObjectCommand) {
        commands.push(command);
        if (command instanceof HeadObjectCommand) {
          return { ContentLength: 12, Metadata: { sha256: 'abc' } };
        }
        return {};
      },
    };
    const publisher = new R2DatasetPublisher(config, client);

    await expect(publisher.inspect('datasets/file.csv')).resolves.toEqual({
      key: 'datasets/file.csv',
      size: 12,
      metadata: { sha256: 'abc' },
    });
    await publisher.put({
      key: 'datasets/file.csv',
      body: Readable.from('content'),
      size: 7,
      contentType: 'text/csv; charset=utf-8',
      contentDisposition: 'attachment; filename="file.csv"',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { sha256: 'abc' },
      immutable: true,
    });

    expect(commands[0]?.input).toEqual({
      Bucket: 'datasets-bucket',
      Key: 'datasets/file.csv',
    });
    expect(commands[1]?.input).toMatchObject({
      Bucket: 'datasets-bucket',
      Key: 'datasets/file.csv',
      ContentLength: 7,
      ContentType: 'text/csv; charset=utf-8',
      ContentDisposition: 'attachment; filename="file.csv"',
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: { sha256: 'abc' },
      IfNoneMatch: '*',
    });
    expect(publisher.publicUrl('datasets/2026/latest/a file.csv')).toBe(
      'https://data.example.com/datasets/2026/latest/a%20file.csv',
    );
  });

  it('reports missing publication configuration without exposing secrets', () => {
    expect(() => readR2Config({})).toThrow(
      'R2 publication configuration is incomplete',
    );
  });

  it('derives the R2 endpoint from the account identifier', () => {
    expect(
      readR2Config({
        R2_ACCOUNT_ID: 'account',
        R2_ACCESS_KEY_ID: 'key',
        R2_SECRET_ACCESS_KEY: 'secret',
        R2_BUCKET: 'bucket',
        R2_PUBLIC_BASE_URL: 'https://data.example.com',
      }).endpoint,
    ).toBe('https://account.r2.cloudflarestorage.com');
  });
});
