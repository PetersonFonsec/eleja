import { resolve } from 'node:path';
import { FileSystemRawStorage } from './file-system-raw-storage.js';
import type { RawStorage } from './raw-storage.js';
import { R2RawStorage, type R2RawStorageConfig } from './r2-raw-storage.js';

export type RawStorageDriver = 'filesystem' | 'r2';

export interface RawStorageSelection {
  driver: RawStorageDriver;
  storage: RawStorage;
}

export function createRawStorage(
  environment: NodeJS.ProcessEnv = process.env,
  repositoryRoot = resolve(__dirname, '../../..'),
): RawStorageSelection {
  const driver = optional(environment.RAW_STORAGE_DRIVER) ?? 'filesystem';
  if (driver === 'filesystem') {
    const root = resolve(
      repositoryRoot,
      environment.RAW_STORAGE_ROOT ?? '.data/raw',
    );
    return { driver, storage: new FileSystemRawStorage(root) };
  }
  if (driver === 'r2') {
    return {
      driver,
      storage: new R2RawStorage(readR2RawStorageConfig(environment)),
    };
  }
  throw new Error(
    `Invalid RAW_STORAGE_DRIVER "${driver}"; expected filesystem or r2`,
  );
}

export function readR2RawStorageConfig(
  environment: NodeJS.ProcessEnv = process.env,
): R2RawStorageConfig {
  const values = {
    accountId: optional(environment.R2_ACCOUNT_ID),
    accessKeyId: optional(environment.R2_ACCESS_KEY_ID),
    secretAccessKey: optional(environment.R2_SECRET_ACCESS_KEY),
    bucket: optional(environment.R2_BUCKET),
  };
  const missing = [
    ['R2_ACCOUNT_ID', values.accountId],
    ['R2_ACCESS_KEY_ID', values.accessKeyId],
    ['R2_SECRET_ACCESS_KEY', values.secretAccessKey],
    ['R2_BUCKET', values.bucket],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `R2 RAW storage configuration is incomplete: missing ${missing.join(', ')}`,
    );
  }
  return {
    endpoint: `https://${values.accountId!}.r2.cloudflarestorage.com`,
    accessKeyId: values.accessKeyId!,
    secretAccessKey: values.secretAccessKey!,
    bucket: values.bucket!,
  };
}

function optional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
