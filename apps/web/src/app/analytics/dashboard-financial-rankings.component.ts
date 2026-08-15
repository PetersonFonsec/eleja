import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  formatBrlDecimal,
  formatDateOnly,
} from '../candidates/candidate-formatters';
import type {
  DeclaredWealthRanking,
  FinancialRankingCandidate,
  ParliamentaryExpenseRanking,
} from './analytics.types';

@Component({
  selector: 'app-dashboard-financial-rankings',
  imports: [RouterLink],
  templateUrl: './dashboard-financial-rankings.component.html',
  styleUrl: './dashboard-financial-rankings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardFinancialRankingsComponent {
  @Input() wealth: DeclaredWealthRanking | null = null;
  @Input() wealthLoading = false;
  @Input() wealthError = false;
  @Input() expenses: ParliamentaryExpenseRanking | null = null;
  @Input() expensesLoading = false;
  @Input() expensesError = false;
  @Output() readonly retryWealth = new EventEmitter<void>();
  @Output() readonly retryExpenses = new EventEmitter<void>();
  readonly money = formatBrlDecimal;
  readonly date = formatDateOnly;

  candidateRoute(candidate: FinancialRankingCandidate): string[] {
    return ['/candidates', candidate.candidateId];
  }
  currentContext(candidate: FinancialRankingCandidate): string {
    return [officeLabel(candidate.officeCode), candidate.state]
      .filter(Boolean)
      .join(' • ');
  }
  wealthMetadata(count: number): string {
    return count === 1 ? '1 bem declarado' : `${count} bens declarados`;
  }
  expenseMetadata(count: number): string {
    return count === 1 ? '1 registro' : `${count} registros`;
  }
  mandateContext(item: ParliamentaryExpenseRanking['data'][number]): string {
    if (item.mandate.legislatureNumber)
      return `Último mandato • ${item.mandate.legislatureNumber}ª Legislatura`;
    if (item.mandate.startedAt)
      return `Último mandato • iniciado em ${this.date(item.mandate.startedAt)}`;
    return 'Último mandato na Câmara';
  }
}

function officeLabel(code: string): string {
  return (
    (
      {
        PRESIDENT: 'Presidente',
        GOVERNOR: 'Governador',
        SENATOR: 'Senador',
        FEDERAL_DEPUTY: 'Deputado Federal',
        STATE_DEPUTY: 'Deputado Estadual',
      } as Record<string, string>
    )[code] ?? code.replaceAll('_', ' ')
  );
}
