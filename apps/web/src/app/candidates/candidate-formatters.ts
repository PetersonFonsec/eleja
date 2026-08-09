export function formatDateOnly(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function formatBrlDecimal(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d{2}))$/.exec(value);
  if (!match) return value;
  const [, sign, integer, fraction] = match;
  const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${sign}${grouped},${fraction}`;
}

export function statusLabel(value: string): string {
  if (value === 'ACTIVE') return 'Ativa';
  if (value === 'INACTIVE') return 'Inativa';
  return 'Não informada';
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
