import { createHash } from 'node:crypto';

const CPF_PATTERN = /^\d{11}$/;
const BRAZILIAN_UF_PATTERN =
  /^(?:A[CLMP]|BA|CE|DF|ES|GO|M[AGST]|P[ABER]|R[JNORS]|S[CEP]|TO)$/;

export type PersonIdentityMatchMethod =
  'EXACT_EXTERNAL_IDENTIFIER' | 'STRONG_COMPOSITE' | 'NEW_PERSON';

export function fingerprintTseCpf(value: string): string | null {
  const cpf = value.trim();
  if (!CPF_PATTERN.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return null;
  return createHash('sha256')
    .update(`eleja:tse:cpf:v1:${cpf}`, 'utf8')
    .digest('hex');
}

export function tseCpfExternalId(fingerprint: string): string {
  return `cpf-sha256:${fingerprint}`;
}

export function normalizeIdentityName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase();
}

export function normalizeBirthState(value: string): string | null {
  const state = value.trim().toUpperCase();
  return BRAZILIAN_UF_PATTERN.test(state) ? state : null;
}
