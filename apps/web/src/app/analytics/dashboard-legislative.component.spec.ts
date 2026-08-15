import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import type { LegislativeAnalytics } from './analytics.types';
import { DashboardLegislativeComponent } from './dashboard-legislative.component';

const analytics: LegislativeAnalytics = {
  filters: { year: 2026, office: 'GOVERNOR', state: 'SP', party: null },
  peopleWithLegislativeHistory: 3,
  populationPeople: 20,
  mandates: 5,
  proposalAuthorships: 12830,
  uniqueProposals: 9850,
  primaryAuthorships: 482,
  individualVotes: 482190,
  parliamentaryExpenses: { count: 381200, totalNetValue: '934827341.50' },
};

describe('DashboardLegislativeComponent', () => {
  it('presents distinct factual metrics with shared exact formatters', () => {
    const component = new DashboardLegislativeComponent();
    component.analytics = analytics;
    expect(component.metrics().map((metric) => metric.label)).toEqual([
      'Pessoas com histórico legislativo',
      'Mandatos na Câmara',
      'Relações de autoria',
      'Proposições únicas',
      'Autorias principais',
      'Votações nominais registradas',
      'Despesas parlamentares registradas',
    ]);
    expect(component.integer.format(12830)).toBe('12.830');
    expect(component.integer.format(482190)).toBe('482.190');
    expect(component.money('934827341.50')).toBe('R$ 934.827.341,50');
    expect(component.metrics().at(-1)?.detail).toContain('valor líquido');
  });

  it('returns no metric cards for the empty input state', () => {
    expect(new DashboardLegislativeComponent().metrics()).toEqual([]);
  });
});
