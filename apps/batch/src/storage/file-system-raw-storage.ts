import { constants } from 'node:fs';
import { access, link, mkdir, unlink } from 'node:fs/promises';
import { basename, dirname, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import type { RawStorage, RawStoragePutResult } from './raw-storage.js';

export class FileSystemRawStorage implements RawStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolveKey(key), constants.F_OK);
      return true;
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async put(key: string, content: Readable): Promise<RawStoragePutResult> {
    const target = this.resolveKey(key);
    const targetDirectory = dirname(target);
    await mkdir(targetDirectory, { recursive: true });

    const temporaryPath = resolve(
      targetDirectory,
      `.${basename(target)}.${randomUUID()}.tmp`,
    );

    try {
      await pipeline(
        content,
        createWriteStream(temporaryPath, { flags: 'wx' }),
      );
      try {
        await link(temporaryPath, target);
        return { stored: true };
      } catch (error: unknown) {
        if (isNodeError(error) && error.code === 'EEXIST') {
          return { stored: false };
        }
        throw error;
      }
    } finally {
      await unlink(temporaryPath).catch((error: unknown) => {
        if (!isNodeError(error) || error.code !== 'ENOENT') {
          throw error;
        }
      });
    }
  }

  private resolveKey(key: string): string {
    if (key.trim().length === 0 || key.includes('\0')) {
      throw new Error('RAW storage key must not be empty');
    }

    const target = resolve(this.root, key);
    if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) {
      throw new Error('RAW storage key must stay inside the configured root');
    }
    return target;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
