import { Routes } from '@angular/router';
import { CandidateDetailPageComponent } from './candidates/candidate-detail-page.component';
import { CandidateComparePageComponent } from './candidates/candidate-compare-page.component';
import { CandidatesPageComponent } from './candidates/candidates-page.component';
import { DashboardPageComponent } from './analytics/dashboard-page.component';

export const routes: Routes = [
  { path: 'candidates', component: CandidatesPageComponent },
  { path: 'candidates/:id', component: CandidateDetailPageComponent },
  { path: 'compare', component: CandidateComparePageComponent },
  { path: 'dashboard', component: DashboardPageComponent },
  { path: '', pathMatch: 'full', redirectTo: 'candidates' },
  { path: '**', redirectTo: 'candidates' },
];
