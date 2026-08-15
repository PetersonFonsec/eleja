import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { formatBrlDecimal } from '../candidates/candidate-formatters';
import type { WealthHistoryPoint } from './analytics.types';

interface PlotPoint extends WealthHistoryPoint {
  x: number;
  y: number;
}

@Component({
  selector: 'app-wealth-history-chart',
  templateUrl: './wealth-history-chart.component.html',
  styleUrl: './wealth-history-chart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WealthHistoryChartComponent {
  @Input() points: WealthHistoryPoint[] = [];
  readonly money = formatBrlDecimal;

  plot(): PlotPoint[] {
    const ordered = [...this.points].sort(
      (a, b) => a.electionYear - b.electionYear,
    );
    // Decimal strings remain authoritative. Number is used only for SVG position.
    const maximum = Math.max(
      ...ordered.map((point) => Number(point.declaredWealth)),
      1,
    );
    return ordered.map((point, index) => ({
      ...point,
      x: ordered.length === 1 ? 50 : 12 + (index * 80) / (ordered.length - 1),
      y: 84 - (Number(point.declaredWealth) / maximum) * 68,
    }));
  }

  line(points: PlotPoint[]): string {
    return points.map((point) => `${point.x},${point.y}`).join(' ');
  }

  axisValue(ratio: number): string {
    const maximum = Math.max(
      ...this.points.map((point) => Number(point.declaredWealth)),
      0,
    );
    return compactBrl(maximum * ratio);
  }

  office(code: string): string {
    return officeLabel(code);
  }
}

export function compactBrl(value: number): string {
  const units: Array<[number, string]> = [
    [1_000_000_000, 'bi'],
    [1_000_000, 'mi'],
    [1_000, 'mil'],
  ];
  const unit = units.find(([threshold]) => value >= threshold);
  if (!unit) return `R$ ${Math.round(value).toLocaleString('pt-BR')}`;
  const scaled = value / unit[0];
  const digits = scaled >= 10 || Number.isInteger(scaled) ? 0 : 1;
  return `R$ ${scaled.toLocaleString('pt-BR', { maximumFractionDigits: digits })} ${unit[1]}`;
}

export function officeLabel(code: string): string {
  return (
    (
      {
        PRESIDENT: 'Presidente',
        VICE_PRESIDENT: 'Vice-presidente',
        GOVERNOR: 'Governador',
        VICE_GOVERNOR: 'Vice-governador',
        SENATOR: 'Senador',
        FEDERAL_DEPUTY: 'Deputado Federal',
        STATE_DEPUTY: 'Deputado Estadual',
        DISTRICT_DEPUTY: 'Deputado Distrital',
      } as Record<string, string>
    )[code] ?? code.replaceAll('_', ' ')
  );
}
