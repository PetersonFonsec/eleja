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

export function formatDateTime(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return match
    ? `${match[3]}/${match[2]}/${match[1]} às ${match[4]}:${match[5]}`
    : value;
}
export function legislativeBodyLabel(value: string): string {
  if (value === 'CHAMBER_OF_DEPUTIES') return 'Deputado Federal';
  return 'Mandato legislativo';
}
export function legislativeStatusLabel(value: string): string {
  if (value === 'ACTIVE') return 'Mandato ativo';
  if (value === 'COMPLETED') return 'Mandato concluído';
  if (value === 'INTERRUPTED') return 'Mandato interrompido';
  return 'Situação não informada';
}
export function votePositionLabel(value: string): string {
  return (
    (
      {
        YES: 'Sim',
        NO: 'Não',
        ABSTENTION: 'Abstenção',
        OBSTRUCTION: 'Obstrução',
        OTHER: 'Outro',
        UNKNOWN: 'Não informado',
      } as Record<string, string>
    )[value] ?? 'Não informado'
  );
}
export function votingResultLabel(value: string): string {
  if (value === 'APPROVED') return 'Aprovada';
  if (value === 'REJECTED') return 'Rejeitada';
  return 'Resultado não informado';
}

export function statusLabel(value: string): string {
  if (value === 'ACTIVE') return 'Ativa';
  if (value === 'INACTIVE') return 'Inativa';
  return 'Não informada';
}

export function electionTypeLabel(value: string): string {
  if (value === 'GENERAL') return 'Eleição Geral';
  if (value === 'MUNICIPAL') return 'Eleição Municipal';
  return value;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
