export const SUPPORTED_HISTORICAL_GENERAL_ELECTION_YEARS = [
  2014, 2018, 2022, 2026,
] as const;

export function readHistoricalYears(arguments_: string[]): number[] {
  const inline = arguments_.find((argument) => argument.startsWith('--years='));
  const index = arguments_.indexOf('--years');
  const value =
    inline?.slice('--years='.length) ??
    (index >= 0 ? arguments_[index + 1] : undefined) ??
    SUPPORTED_HISTORICAL_GENERAL_ELECTION_YEARS.join(',');
  const years = value.split(',').map((item) => Number(item.trim()));
  if (
    years.length === 0 ||
    years.some(
      (year) =>
        !SUPPORTED_HISTORICAL_GENERAL_ELECTION_YEARS.includes(
          year as (typeof SUPPORTED_HISTORICAL_GENERAL_ELECTION_YEARS)[number],
        ),
    )
  ) {
    throw new Error(
      `--years must contain only ${SUPPORTED_HISTORICAL_GENERAL_ELECTION_YEARS.join(', ')}`,
    );
  }
  return [...new Set(years)].sort((left, right) => left - right);
}
