import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import type { AnalyticsCoverage } from './analytics.types';

@Component({
  selector: 'app-dashboard-coverage',
  templateUrl: './dashboard-coverage.component.html',
  styleUrl: './dashboard-coverage.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardCoverageComponent {
  @Input() coverage: AnalyticsCoverage | null = null;
  @Input() loading = false;
  @Input() error = false;
  @Output() readonly retry = new EventEmitter<void>();
  readonly integer = new Intl.NumberFormat('pt-BR');
  readonly percentage = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });

  items() {
    const data = this.coverage;
    if (!data) return [];
    return [
      ['Patrimônio declarado', data.coverage.withAssets],
      ['Histórico patrimonial', data.coverage.withHistoricalAssetSeries],
      ['Identificação na Câmara', data.coverage.withCamaraIdentity],
      ['Mandatos', data.coverage.withMandates],
      ['Proposições', data.coverage.withProposals],
      ['Votações', data.coverage.withVotes],
      ['Despesas parlamentares', data.coverage.withExpenses],
    ] as const;
  }
  percent(count: number): number {
    const total = this.coverage?.candidateCount ?? 0;
    return total > 0 ? Math.min(100, (count / total) * 100) : 0;
  }
}
