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

  groups() {
    const data = this.coverage;
    if (!data) return [];
    return [
      {
        source: 'Tribunal Superior Eleitoral (TSE)',
        items: [
          {
            label: 'Patrimônio declarado',
            count: data.coverage.withAssets,
            total: data.candidateCount,
            population: 'candidaturas',
          },
          {
            label: 'Histórico patrimonial',
            count: data.coverage.withHistoricalAssetSeries,
            total: data.distinctPeople,
            population: 'pessoas',
          },
        ] as const,
      },
      {
        source: 'Câmara dos Deputados',
        items: [
          ['Identificação na Câmara', data.coverage.withCamaraIdentity],
          ['Mandatos', data.coverage.withMandates],
          ['Proposições', data.coverage.withProposals],
          ['Votações nominais', data.coverage.withVotes],
          ['Despesas parlamentares', data.coverage.withExpenses],
        ].map(([label, count]) => ({
          label,
          count,
          total: data.distinctPeople,
          population: 'pessoas',
        })) as ReadonlyArray<{
          label: string;
          count: number;
          total: number;
          population: string;
        }>,
      },
    ] as const;
  }
  percent(count: number, total = this.coverage?.candidateCount ?? 0): number {
    return total > 0 ? Math.min(100, (count / total) * 100) : 0;
  }
}
