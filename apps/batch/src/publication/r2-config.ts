export interface R2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

export function readR2Config(environment = process.env): R2Config {
  const accountId = optional(environment.R2_ACCOUNT_ID);
  const endpoint =
    optional(environment.R2_ENDPOINT) ??
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const accessKeyId = optional(environment.R2_ACCESS_KEY_ID);
  const secretAccessKey = optional(environment.R2_SECRET_ACCESS_KEY);
  const bucket = optional(environment.R2_BUCKET);
  const publicBaseUrl = optional(environment.R2_PUBLIC_BASE_URL);
  const required = [
    ['R2_ENDPOINT or R2_ACCOUNT_ID', endpoint],
    ['R2_ACCESS_KEY_ID', accessKeyId],
    ['R2_SECRET_ACCESS_KEY', secretAccessKey],
    ['R2_BUCKET', bucket],
    ['R2_PUBLIC_BASE_URL', publicBaseUrl],
  ] as const;
  const missing = required
    .filter(([, value]) => value === undefined)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `R2 publication configuration is incomplete: missing ${missing.join(', ')}`,
    );
  }
  return {
    endpoint: endpoint!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucket: bucket!,
    publicBaseUrl: publicBaseUrl!,
  };
}

function optional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
