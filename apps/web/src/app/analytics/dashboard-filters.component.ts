import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import type { AnalyticsFilters } from './analytics.types';

export const DASHBOARD_OFFICES = [
  ['PRESIDENT', 'Presidente'],
  ['GOVERNOR', 'Governador'],
  ['SENATOR', 'Senador'],
  ['FEDERAL_DEPUTY', 'Deputado Federal'],
  ['STATE_DEPUTY', 'Deputado Estadual'],
] as const;
export const DASHBOARD_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

@Component({
  selector: 'app-dashboard-filters',
  templateUrl: './dashboard-filters.component.html',
  styleUrl: './dashboard-filters.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardFiltersComponent {
  @Input({ required: true }) filters!: AnalyticsFilters;
  @Output() readonly filterChange = new EventEmitter<
    Partial<AnalyticsFilters>
  >();
  readonly offices = DASHBOARD_OFFICES;
  readonly states = DASHBOARD_STATES;

  change(key: 'year' | 'office' | 'state' | 'party', value: string): void {
    const normalized = value.trim();
    this.filterChange.emit({
      [key]: key === 'year' ? Number(normalized) : normalized || undefined,
    });
  }
}
