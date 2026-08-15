import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { readR2RawStorageConfig } from './storage/raw-storage-factory.js';
import { R2RawStorage } from './storage/r2-raw-storage.js';

async function main(): Promise<void> {
  const config = readR2RawStorageConfig();
  const storage = new R2RawStorage(config);
  const payload = Buffer.from('Eleja Cloudflare R2 integration check\n');
  const checksum = createHash('sha256').update(payload).digest('hex');
  const key = `health/${checksum}/r2-check.txt`;

  console.log('Cloudflare R2 check');
  console.log(`Bucket: ${config.bucket}`);
  console.log(`Endpoint: ${config.endpoint}`);
  const uploaded = await storage.put(key, Readable.from(payload), {
    contentLength: payload.length,
    contentType: 'text/plain; charset=utf-8',
    metadata: { sha256: checksum },
  });
  console.log(`Upload: ${uploaded.stored ? 'OK' : 'EXISTING'}`);
  if (!(await storage.exists(key))) throw new Error('Exists check failed');
  console.log('Exists: OK');
  const content = await storage.get(key);
  const chunks: Buffer[] = [];
  for await (const chunk of content) chunks.push(Buffer.from(chunk));
  const downloadedChecksum = createHash('sha256')
    .update(Buffer.concat(chunks))
    .digest('hex');
  if (downloadedChecksum !== checksum) throw new Error('SHA-256 check failed');
  console.log('Download: OK');
  console.log('SHA-256: OK');
  console.log('R2 integration is working.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
