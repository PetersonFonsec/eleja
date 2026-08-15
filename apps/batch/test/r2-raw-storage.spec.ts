import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { R2RawStorage } from '../src/storage/r2-raw-storage.js';

const config = {
  endpoint: 'https://account.r2.cloudflarestorage.com',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  bucket: 'bucket',
};

describe('R2RawStorage', () => {
  it('uploads a stream with metadata and reads it back as a stream', async () => {
    const commands: Array<
      HeadObjectCommand | GetObjectCommand | PutObjectCommand
    > = [];
    const client = {
      async send(
        command: HeadObjectCommand | GetObjectCommand | PutObjectCommand,
      ) {
        commands.push(command);
        if (command instanceof HeadObjectCommand)
          throw sdkError('NotFound', 404);
        if (command instanceof GetObjectCommand)
          return { Body: Readable.from('content') };
        return {};
      },
    };
    const storage = new R2RawStorage(config, client);
    await expect(
      storage.put('raw.zip', Readable.from('content'), {
        contentLength: 7,
        contentType: 'application/zip',
        metadata: { sha256: 'abc' },
      }),
    ).resolves.toEqual({ stored: true });
    expect(commands[1]?.input).toMatchObject({
      Bucket: 'bucket',
      Key: 'raw.zip',
      ContentLength: 7,
      ContentType: 'application/zip',
      Metadata: { sha256: 'abc' },
      IfNoneMatch: '*',
    });
    const body = await storage.get('raw.zip');
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe('content');
  });

  it('reuses an existing object without uploading it', async () => {
    const commands: Array<
      HeadObjectCommand | GetObjectCommand | PutObjectCommand
    > = [];
    const storage = new R2RawStorage(config, {
      async send(command) {
        commands.push(command);
        return {};
      },
    });
    await expect(storage.put('same.zip', Readable.from('x'))).resolves.toEqual({
      stored: false,
    });
    expect(commands).toHaveLength(1);
    expect(commands[0]).toBeInstanceOf(HeadObjectCommand);
  });

  it('returns false for a missing object', async () => {
    const storage = new R2RawStorage(config, {
      async send() {
        throw sdkError('NotFound', 404);
      },
    });
    await expect(storage.exists('missing.zip')).resolves.toBe(false);
  });

  it.each([
    ['AccessDenied', 403, 'access was denied'],
    ['TimeoutError', undefined, 'timed out'],
    ['NetworkingError', undefined, 'request failed'],
  ])(
    'maps %s failures without exposing SDK details',
    async (name, status, message) => {
      const storage = new R2RawStorage(config, {
        async send() {
          throw sdkError(name, status);
        },
      });
      await expect(storage.exists('key')).rejects.toThrow(message);
      await expect(storage.exists('key')).rejects.not.toThrow('secret');
    },
  );
});

function sdkError(name: string, status?: number): Error {
  const error = new Error(
    'raw SDK message containing sensitive request details',
  ) as Error & { $metadata?: { httpStatusCode?: number } };
  error.name = name;
  error.$metadata = { httpStatusCode: status };
  return error;
}
