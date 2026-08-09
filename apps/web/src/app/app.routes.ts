import { Routes } from '@angular/router';
import { CandidateDetailPlaceholderComponent } from './candidate-detail-placeholder.component';
import { CandidatesPageComponent } from './candidates/candidates-page.component';

export const routes: Routes = [
  { path: 'candidates', component: CandidatesPageComponent },
  { path: 'candidates/:id', component: CandidateDetailPlaceholderComponent },
  { path: '', pathMatch: 'full', redirectTo: 'candidates' },
  { path: '**', redirectTo: 'candidates' },
];
