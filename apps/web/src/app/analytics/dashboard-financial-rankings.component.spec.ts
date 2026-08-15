import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import type { ParliamentaryExpenseRankingItem } from './analytics.types';
import { DashboardFinancialRankingsComponent } from './dashboard-financial-rankings.component';

describe('DashboardFinancialRankingsComponent', () => {
  const component = new DashboardFinancialRankingsComponent();

  it('formats exact decimal strings as complete BRL values', () => {
    expect(component.money('0.01')).toBe('R$ 0,01');
    expect(component.money('1000.10')).toBe('R$ 1.000,10');
    expect(component.money('12450000.75')).toBe('R$ 12.450.000,75');
    expect(component.money('999999999.99')).toBe('R$ 999.999.999,99');
  });

  it('navigates by candidacy identity rather than person identity', () => {
    expect(
      component.candidateRoute({
        candidateId: 'candidate-2026',
        personId: 'person-historical',
        ballotName: 'Nome de urna',
        fullName: 'Nome completo',
        officeCode: 'FEDERAL_DEPUTY',
        state: 'SP',
        partyAcronym: 'ABC',
      }),
    ).toEqual(['/candidates', 'candidate-2026']);
  });

  it('describes counts and the mandate separately from the current candidacy', () => {
    const item = {
      mandate: {
        id: 'mandate-1',
        legislatureNumber: 57,
        startedAt: '2023-02-01',
        endedAt: null,
      },
    } as ParliamentaryExpenseRankingItem;
    expect(component.wealthMetadata(1)).toBe('1 bem declarado');
    expect(component.wealthMetadata(2)).toBe('2 bens declarados');
    expect(component.expenseMetadata(1)).toBe('1 registro');
    expect(component.expenseMetadata(3)).toBe('3 registros');
    expect(component.mandateContext(item)).toBe(
      'Último mandato • 57ª Legislatura',
    );
  });
});
