import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { publicText, writeCsvExport } from '../src/export/csv-export-writer.js';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('CSV export writer', () => {
  it('writes UTF-8, RFC-compatible escaping, LF and formula protection', async () => {
    const directory = await temporaryDirectory();
    const result = await writeCsvExport({
      dataset: 'CANDIDATES',
      year: 2026,
      fileName: 'test.csv',
      outputDirectory: directory,
      columns: ['name', 'description', 'occupation'],
      records: records([
        {
          name: publicText('João Gonçalves'),
          description: publicText('Apartamento "Residencial", Centro'),
          occupation: publicText('Educação\nSuperior'),
        },
        {
          name: publicText('=SUM(A1:A2)'),
          description: publicText('+cmd'),
          occupation: publicText('@something'),
        },
      ]),
    });
    const content = await readFile(result.path, 'utf8');
    expect(content).toBe(
      'name,description,occupation\n' +
        'João Gonçalves,"Apartamento ""Residencial"", Centro","Educação\nSuperior"\n' +
        "'=SUM(A1:A2),'+cmd,'@something\n",
    );
    expect(content).not.toContain('\r');
    expect(result).toMatchObject({ rows: 2, size: Buffer.byteLength(content) });
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('does not replace a complete file when a later export fails', async () => {
    const directory = await temporaryDirectory();
    const options = {
      dataset: 'CANDIDATES' as const,
      year: 2026,
      fileName: 'atomic.csv',
      outputDirectory: directory,
      columns: ['value'],
    };
    const first = await writeCsvExport({
      ...options,
      records: records([{ value: 'complete' }]),
    });
    async function* failingRecords() {
      yield { value: 'partial' };
      throw new Error('export failed');
    }
    await expect(
      writeCsvExport({ ...options, records: failingRecords() }),
    ).rejects.toThrow('export failed');
    await expect(readFile(first.path, 'utf8')).resolves.toBe(
      'value\ncomplete\n',
    );
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'eleja-csv-export-'));
  directories.push(directory);
  return directory;
}

async function* records(values: Record<string, unknown>[]) {
  yield* values;
}
