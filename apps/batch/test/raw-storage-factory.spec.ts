import { describe, expect, it } from 'vitest';
import { FileSystemRawStorage } from '../src/storage/file-system-raw-storage.js';
import {
  createRawStorage,
  readR2RawStorageConfig,
} from '../src/storage/raw-storage-factory.js';
import { R2RawStorage } from '../src/storage/r2-raw-storage.js';

describe('RAW storage configuration', () => {
  it('defaults to filesystem without requiring R2 credentials', () => {
    const result = createRawStorage({}, '/private/tmp/eleja');
    expect(result.driver).toBe('filesystem');
    expect(result.storage).toBeInstanceOf(FileSystemRawStorage);
  });

  it('constructs R2 storage from the required environment', () => {
    const result = createRawStorage({
      RAW_STORAGE_DRIVER: 'r2',
      R2_ACCOUNT_ID: 'account',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET: 'bucket',
    });
    expect(result.driver).toBe('r2');
    expect(result.storage).toBeInstanceOf(R2RawStorage);
    expect(
      readR2RawStorageConfig({
        R2_ACCOUNT_ID: 'account',
        R2_ACCESS_KEY_ID: 'key',
        R2_SECRET_ACCESS_KEY: 'secret',
        R2_BUCKET: 'bucket',
      }).endpoint,
    ).toBe('https://account.r2.cloudflarestorage.com');
  });

  it.each([
    [
      'R2_ACCOUNT_ID',
      {
        R2_ACCESS_KEY_ID: 'key',
        R2_SECRET_ACCESS_KEY: 'secret',
        R2_BUCKET: 'bucket',
      },
    ],
    [
      'R2_ACCESS_KEY_ID',
      {
        R2_ACCOUNT_ID: 'account',
        R2_SECRET_ACCESS_KEY: 'secret',
        R2_BUCKET: 'bucket',
      },
    ],
  ])('rejects R2 mode when %s is missing', (name, environment) => {
    expect(() =>
      createRawStorage({ RAW_STORAGE_DRIVER: 'r2', ...environment }),
    ).toThrow(name);
  });

  it('rejects an unknown driver instead of silently falling back', () => {
    expect(() => createRawStorage({ RAW_STORAGE_DRIVER: 'unknown' })).toThrow(
      'Invalid RAW_STORAGE_DRIVER',
    );
  });
});
