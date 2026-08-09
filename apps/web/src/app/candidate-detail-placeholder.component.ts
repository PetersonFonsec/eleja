import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-candidate-detail-placeholder',
  imports: [RouterLink],
  template: `<main>
    <a routerLink="/candidates">← Voltar para candidatos</a>
    <h1>Perfil do candidato</h1>
    <p>Esta página será implementada na próxima etapa.</p>
  </main>`,
  styles: [
    `
      main {
        margin: 4rem auto;
        max-width: 45rem;
        padding: 0 1rem;
      }
      a {
        color: #176052;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidateDetailPlaceholderComponent {}
