import { Routes } from '@angular/router';
import { CandidateDetailPageComponent } from './candidates/candidate-detail-page.component';
import { CandidatesPageComponent } from './candidates/candidates-page.component';

export const routes: Routes = [
  { path: 'candidates', component: CandidatesPageComponent },
  { path: 'candidates/:id', component: CandidateDetailPageComponent },
  { path: '', pathMatch: 'full', redirectTo: 'candidates' },
  { path: '**', redirectTo: 'candidates' },
];
