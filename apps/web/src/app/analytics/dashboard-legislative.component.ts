import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { formatBrlDecimal } from '../candidates/candidate-formatters';
import type { LegislativeAnalytics } from './analytics.types';

@Component({
  selector: 'app-dashboard-legislative',
  templateUrl: './dashboard-legislative.component.html',
  styleUrl: './dashboard-legislative.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardLegislativeComponent {
  @Input() analytics: LegislativeAnalytics | null = null;
  @Input() loading = false;
  @Input() error = false;
  @Output() readonly retry = new EventEmitter<void>();
  readonly integer = new Intl.NumberFormat('pt-BR');
  readonly money = formatBrlDecimal;

  metrics(): Array<{ label: string; value: number; detail?: string }> {
    const data = this.analytics;
    if (!data) return [];
    return [
      {
        label: 'Pessoas com histórico legislativo',
        value: data.peopleWithLegislativeHistory,
        detail: `de ${this.integer.format(data.populationPeople)} pessoas na população`,
      },
      { label: 'Mandatos na Câmara', value: data.mandates },
      { label: 'Relações de autoria', value: data.proposalAuthorships },
      { label: 'Proposições únicas', value: data.uniqueProposals },
      { label: 'Autorias principais', value: data.primaryAuthorships },
      { label: 'Votações nominais registradas', value: data.individualVotes },
      {
        label: 'Despesas parlamentares registradas',
        value: data.parliamentaryExpenses.count,
        detail: `${this.money(data.parliamentaryExpenses.totalNetValue)} em valor líquido registrado`,
      },
    ];
  }
}
